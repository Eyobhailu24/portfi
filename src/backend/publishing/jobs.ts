import JSZip from "jszip";
import { HTTPException } from "hono/http-exception";
import { database } from "@/backend/auth";
import { authorizeExport, readInContext } from "@/backend/services/projects";
import { portableAssets } from "@/backend/services/assets";
import { withOwner } from "@/backend/services/workspace-store";
import type { Identity } from "@/backend/services/identity";
import type { Project } from "@/shared/portfolio/schema";
import { checkDocument } from "@/backend/billing/entitlements";
import { exportProject } from "./exporter";
import { providerReady } from "./connections";
import { githubClient, ProviderError, validRepoName, vercelClient, type SourceFile } from "./providers";

type JobState = { project: Project; repositoryName: string; repository?: { id: number; full_name: string; default_branch: string; description: string }; previousCommit?: string; commit?: string; vercelProject?: { id: string; name: string }; deployment?: { id: string; url: string; readyState: string }; deploymentSubmitted?: boolean; message?: string; cancelRequested?: boolean; createdAt: string };
type Job = { id: string; owner_id: string; project_id: string; status: string; state: JobState; attempts: number; lease_token: string; created_at: Date };
export const publishingReady = () => Boolean(database() && providerReady("github") && providerReady("vercel") && process.env.PUBLISH_WORKER_ENABLED === "true");
const terminal = ["succeeded", "failed", "canceled", "needs_attention"];

export function jobSummary(job: Pick<Job, "id" | "status" | "state" | "attempts">) {
  return { id: job.id, status: job.status, revision: job.state.project.revision, attempts: job.attempts, message: job.state.message || "", repository: job.state.repository ? `https://github.com/${job.state.repository.full_name}` : null, url: job.state.deployment?.url ? `https://${job.state.deployment.url}` : null, createdAt: job.state.createdAt };
}

export async function queuePublish(user: Identity, id: string, expectedRevision: number, repositoryName: string, idempotencyKey: string) {
  if (!publishingReady()) throw new HTTPException(503, { message: "Connected publishing needs GitHub, Vercel, encryption, and worker settings. Source export is available now." });
  if (!validRepoName(repositoryName)) throw new HTTPException(400, { message: "Choose a repository name using letters, numbers, dots, hyphens, or underscores." });
  await authorizeExport(user, id);
  return withOwner(user, async (context) => {
    const project = await readInContext(context, id);
    if (project.revision !== expectedRevision) throw new HTTPException(409, { message: "Your portfolio changed. Save and try publishing again." });
    if (!context.state.connections.github || !context.state.connections.vercel) throw new HTTPException(409, { message: "Connect GitHub and Vercel in settings first." });
    const duplicate = await context.db!.query("SELECT * FROM portfi_publish_jobs WHERE owner_id=$1 AND idempotency_key=$2", [user.id, idempotencyKey]);
    if (duplicate.rows[0]) {
      const existing = duplicate.rows[0] as Job;
      if (existing.project_id !== id || existing.state.project.revision !== expectedRevision || existing.state.repositoryName !== repositoryName) throw new HTTPException(409, { message: "This publish request key was already used for another version." });
      return jobSummary(existing);
    }
    const active = await context.db!.query("SELECT * FROM portfi_publish_jobs WHERE owner_id=$1 AND project_id=$2 AND status NOT IN ('succeeded','failed','canceled','needs_attention') ORDER BY created_at DESC LIMIT 1", [user.id, id]);
    if (active.rows[0]) return jobSummary(active.rows[0]);
    const recent = await context.db!.query("SELECT count(*)::int AS total FROM portfi_publish_jobs WHERE owner_id=$1 AND created_at > now() - interval '1 hour'", [user.id]);
    if (recent.rows[0].total >= 10) throw new HTTPException(429, { message: "You can start up to 10 publishes per hour. Wait before publishing again." });
    const previous = await context.db!.query("SELECT state FROM portfi_publish_jobs WHERE owner_id=$1 AND project_id=$2 AND state->>'commit' IS NOT NULL ORDER BY created_at DESC LIMIT 1", [user.id, id]);
    const previousState = previous.rows[0]?.state as JobState | undefined;
    const state: JobState = { project, repositoryName, previousCommit: previousState?.repositoryName === repositoryName ? previousState.commit : undefined, createdAt: new Date().toISOString() };
    const jobId = crypto.randomUUID();
    await context.db!.query("INSERT INTO portfi_publish_jobs(id,owner_id,project_id,idempotency_key,state) VALUES($1,$2,$3,$4,$5)", [jobId, user.id, id, idempotencyKey, JSON.stringify(state)]);
    return jobSummary({ id: jobId, status: "queued", state, attempts: 0 });
  });
}

export async function listJobs(user: Identity, projectId: string) {
  await authorizeRead(user, projectId);
  return (await database()!.query("SELECT id,status,state,attempts FROM portfi_publish_jobs WHERE owner_id=$1 AND project_id=$2 ORDER BY created_at DESC LIMIT 20", [user.id, projectId])).rows.map(jobSummary);
}
async function authorizeRead(user: Identity, projectId: string) {
  if (user.mode !== "account" || !database()) throw new HTTPException(401, { message: "Sign in to view connected publishing." });
  await withOwner(user, (context) => readInContext(context, projectId));
}
export async function jobAction(user: Identity, id: string, action: "retry" | "cancel") {
  return withOwner(user, async (context) => {
    const result = await context.db!.query("SELECT * FROM portfi_publish_jobs WHERE owner_id=$1 AND id=$2 FOR UPDATE", [user.id, id]);
    const job = result.rows[0] as Job | undefined;
    if (!job) throw new HTTPException(404, { message: "Publish job not found." });
    if (action === "cancel") {
      if (job.status === "succeeded") throw new HTTPException(409, { message: "This deployment is already live. Manage it in your Vercel account." });
      job.state.cancelRequested = true;
      // An in-flight provider request needs worker reconciliation, including when
      // the job is between polls. A local cancellation is not provider confirmation.
      const status = job.status === "running" ? "running" : job.state.deploymentSubmitted || job.state.deployment ? "queued" : "canceled";
      job.state.message = status === "canceled" ? "Publishing was canceled." : "Cancellation requested. Waiting for Vercel confirmation.";
      await context.db!.query("UPDATE portfi_publish_jobs SET state=$1,status=$2,available_at=now(),updated_at=now() WHERE id=$3", [JSON.stringify(job.state), status, id]);
      return jobSummary({ ...job, status });
    }
    if (!["failed", "needs_attention"].includes(job.status)) return jobSummary(job);
    if (context.state.metadata[job.project_id]?.archivedAt || context.state.metadata[job.project_id]?.trashedAt) throw new HTTPException(409, { message: "Restore the portfolio before retrying publishing." });
    checkDocument(context, job.state.project, undefined, true);
    if (job.state.deployment && ["ERROR", "CANCELED"].includes(job.state.deployment.readyState)) {
      // A provider-confirmed failure can safely start a new deployment attempt.
      job.state.deployment = undefined; job.state.deploymentSubmitted = false;
    }
    job.state.cancelRequested = false;
    await context.db!.query("UPDATE portfi_publish_jobs SET status='queued',attempts=0,state=$1,available_at=now(),lease_until=NULL,lease_token=NULL,updated_at=now() WHERE id=$2", [JSON.stringify(job.state), id]);
    return jobSummary({ ...job, status: "queued", attempts: 0 });
  });
}

async function claimJob(): Promise<Job | null> {
  const token = crypto.randomUUID();
  const result = await database()!.query("UPDATE portfi_publish_jobs SET status='running',attempts=attempts+1,lease_until=now()+interval '90 seconds',lease_token=$1,updated_at=now() WHERE id=(SELECT id FROM portfi_publish_jobs WHERE ((status IN ('queued','retrying') AND available_at<=now()) OR (status='running' AND lease_until<now())) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *", [token]);
  return result.rows[0] || null;
}

async function saveJob(job: Job, status = "running", seconds = 0) {
  const result = await database()!.query("UPDATE portfi_publish_jobs SET state=$1::jsonb || jsonb_build_object('cancelRequested', COALESCE((state->>'cancelRequested')::boolean,false) OR COALESCE(($1::jsonb->>'cancelRequested')::boolean,false)),status=$2,available_at=now()+($3 * interval '1 second'),lease_until=CASE WHEN $2='running' THEN now()+interval '90 seconds' ELSE NULL END,updated_at=now() WHERE id=$4 AND lease_token=$5 RETURNING id", [JSON.stringify(job.state), status, seconds, job.id, job.lease_token]);
  if (!result.rowCount) throw new Error("Publish lease was lost; another worker is handling it.");
}

/** Processes one durable, leased step sequence. Returning to the queue while Vercel
 * builds avoids long-running HTTP requests and allows restarts at checkpoints. */
export async function processPublishJob(): Promise<boolean> {
  if (!publishingReady()) return false;
  const job = await claimJob();
  if (!job) return false;
  const user: Identity = { id: job.owner_id, mode: "account", name: "", email: "", verified: true };
  let leaseLost = false;
  const heartbeat = setInterval(() => { void database()!.query("UPDATE portfi_publish_jobs SET lease_until=now()+interval '90 seconds' WHERE id=$1 AND lease_token=$2 AND status='running' RETURNING state", [job.id, job.lease_token]).then((result) => { if (!result.rowCount) leaseLost = true; if (result.rows[0]?.state.cancelRequested) job.state.cancelRequested = true; }).catch(() => { leaseLost = true; }); }, 20_000);
  heartbeat.unref();
  try {
    const check = async () => {
      if (leaseLost) throw new Error("The publish worker lease expired.");
      const current = await database()!.query("SELECT state FROM portfi_publish_jobs WHERE id=$1 AND lease_token=$2", [job.id, job.lease_token]);
      if (!current.rowCount) throw new Error("The publish worker lease expired.");
      if (current.rows[0].state.cancelRequested) throw new HTTPException(409, { message: "Publishing was canceled." });
      await authorizeExport(user, job.project_id);
      await withOwner(user, async (context) => { checkDocument(context, job.state.project, undefined, true); });
    };
    await check();
    const github = await githubClient(user);
    const vercel = await vercelClient(user);
    if (!job.state.repository) {
      job.state.repository = await github.ensureRepository(job.state.repositoryName, job.project_id, job.id);
      await saveJob(job);
    }
    const { project, files: assets } = await portableAssets(user, job.state.project);
    const archive = await JSZip.loadAsync(await exportProject(project, assets));
    const files: SourceFile[] = await Promise.all(Object.entries(archive.files).filter(([, entry]) => !entry.dir).map(async ([name, entry]) => ({ name, buffer: await entry.async("nodebuffer") })));
    if (!job.state.commit) {
      await check();
      job.state.commit = await github.commit(job.state.repository, files, job.project_id, job.id, job.state.previousCommit, job.state.createdAt);
      await saveJob(job);
    }
    if (!job.state.vercelProject) { await check(); job.state.vercelProject = await vercel.ensureProject(job.state.repositoryName, job.project_id); await saveJob(job); }
    if (!job.state.deployment) {
      await check();
      const recovered = await vercel.findDeployment(job.state.vercelProject.id, job.id);
      if (recovered) job.state.deployment = recovered;
      else if (job.state.deploymentSubmitted) {
        job.state.message = "Vercel has not confirmed the previous request. Check your Vercel dashboard, then retry this status check. Portfi will not create a second deployment while the result is uncertain.";
        await saveJob(job, job.attempts < 10 ? "retrying" : "needs_attention", 30);
        return true;
      } else {
        // Checkpoint intent before the non-idempotent provider call. On a network
        // failure the next worker reconciles by metadata instead of posting twice.
        job.state.deploymentSubmitted = true; await saveJob(job);
        try { job.state.deployment = await vercel.deploy(job.state.vercelProject, files, job.id, job.state.commit); }
        catch (error) { if (error instanceof ProviderError && !error.uncertain) job.state.deploymentSubmitted = false; throw error; }
      }
      await saveJob(job);
    }
    await check();
    job.state.deployment = await vercel.status(job.state.deployment.id);
    const status = job.state.deployment.readyState;
    if (status === "READY") { job.state.message = "Your portfolio is live in your Vercel account."; await saveJob(job, "succeeded"); }
    else if (["ERROR", "CANCELED"].includes(status)) { job.state.message = "Vercel reported a failed or canceled build. Review its build logs, then retry."; await saveJob(job, "failed"); }
    else { job.state.message = "Vercel is building your portfolio."; await saveJob(job, job.attempts < 120 ? "retrying" : "needs_attention", 15); }
  } catch (error) {
    if (!leaseLost) {
      const current = await database()!.query("SELECT state FROM portfi_publish_jobs WHERE id=$1 AND lease_token=$2", [job.id, job.lease_token]);
      if (current.rows[0]?.state.cancelRequested) {
        try {
          if (job.state.deploymentSubmitted || job.state.deployment) {
            const vercel = await vercelClient(user);
            job.state.deployment ??= job.state.vercelProject ? await vercel.findDeployment(job.state.vercelProject.id, job.id) || undefined : undefined;
            if (!job.state.deployment) throw new Error("Deployment request is still unconfirmed.");
            job.state.deployment = await vercel.status(job.state.deployment.id);
            if (job.state.deployment.readyState === "READY") {
              job.state.message = "The deployment went live before cancellation completed. Manage it in your Vercel account.";
              await saveJob(job, "succeeded");
              return true;
            }
            if (!["ERROR", "CANCELED"].includes(job.state.deployment.readyState)) await vercel.cancel(job.state.deployment.id);
          }
          job.state.message = "Publishing was canceled. Your source and any previous live deployment remain in your accounts.";
          await saveJob(job, "canceled");
        } catch {
          job.state.message = "Vercel has not confirmed cancellation. Reconnect Vercel if needed, or cancel the build in its dashboard.";
          await saveJob(job, job.attempts < 10 ? "retrying" : "needs_attention", 30);
        }
      } else {
        const transient = error instanceof ProviderError && (error.uncertain || error.status === 429);
        job.state.message = error instanceof ProviderError || error instanceof HTTPException ? error.message : "Publishing stopped unexpectedly. Retry the job; completed steps are retained.";
        await saveJob(job, transient && job.attempts < 8 ? "retrying" : "failed", Math.min(300, 2 ** job.attempts * 5));
      }
    }
  } finally { clearInterval(heartbeat); }
  return true;
}
