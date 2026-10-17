import { readFile, unlink } from "node:fs/promises";
import { HTTPException } from "hono/http-exception";
import { projectSchema, type Project } from "@/shared/portfolio/schema";
import { entitlements } from "@/backend/billing/entitlements";
import { atomicJson, dataPath, ownerKey, readJson, type OwnerContext } from "./workspace-store";

export type RevisionInfo = { revision: number; createdAt: string; label: string };
function file(context: OwnerContext, id: string, suffix: string) { return dataPath("revisions", ownerKey(context.user), id, suffix); }

export async function checkpoint(context: OwnerContext, project: Project, label: string, renameExisting = false) {
  const cutoff = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const retainedLimit = context.user.mode === "guest" ? 30 : 200;
  if (label === "Saved changes") {
    const latest = context.db ? (await context.db.query("SELECT created_at FROM portfi_revisions WHERE owner_id=$1 AND project_id=$2 ORDER BY revision DESC LIMIT 1", [context.user.id, project.id])).rows[0]?.created_at : (await readJson<RevisionInfo[]>(file(context, project.id, "index.json"), []))[0]?.createdAt;
    if (latest && Date.now() - new Date(latest).getTime() < 60_000) return;
  }
  if (context.db) {
    await context.db.query("INSERT INTO portfi_revisions(project_id, owner_id, revision, label, document) VALUES($1,$2,$3,$4,$5) ON CONFLICT(project_id,revision) DO UPDATE SET label=EXCLUDED.label WHERE $6", [project.id, context.user.id, project.revision, label, JSON.stringify(project), renameExisting]);
    await context.db.query("DELETE FROM portfi_revisions WHERE owner_id=$1 AND project_id=$2 AND revision <> $3 AND (created_at < $4 OR revision NOT IN (SELECT revision FROM portfi_revisions WHERE owner_id=$1 AND project_id=$2 ORDER BY revision DESC LIMIT $5))", [context.user.id, project.id, project.revision, cutoff, retainedLimit]);
  } else {
    const index = await readJson<RevisionInfo[]>(file(context, project.id, "index.json"), []);
    const existing = index.find((item) => item.revision === project.revision);
    const entry = existing ? { ...existing, label: renameExisting ? label : existing.label } : { revision: project.revision, createdAt: new Date().toISOString(), label };
    const next = [entry, ...index.filter((item) => item.revision !== project.revision)].sort((a, b) => b.revision - a.revision);
    const retained = next.filter((item, index) => index === 0 || item.createdAt >= cutoff).slice(0, retainedLimit);
    if (!existing) await atomicJson(file(context, project.id, `${project.revision}.json`), project);
    await atomicJson(file(context, project.id, "index.json"), retained);
    for (const item of index.filter((item) => !retained.some((keep) => keep.revision === item.revision))) await unlink(file(context, project.id, `${item.revision}.json`)).catch((error) => { if (error.code !== "ENOENT") throw error; });
  }
}

export async function revisionList(context: OwnerContext, project: Project): Promise<RevisionInfo[]> {
  const plan = entitlements(context);
  if (!plan.historyDays && context.user.mode !== "guest") return [];
  const cutoff = new Date(Date.now() - Math.max(1, plan.historyDays) * 86_400_000).toISOString();
  if (context.db) {
    const result = await context.db.query("SELECT revision, created_at, label FROM portfi_revisions WHERE owner_id=$1 AND project_id=$2 AND created_at >= $3 AND revision <= $4 ORDER BY revision DESC LIMIT $5", [context.user.id, project.id, cutoff, project.revision, plan.historyLimit]);
    return result.rows.map((row) => ({ revision: row.revision, createdAt: new Date(row.created_at).toISOString(), label: row.label }));
  }
  return (await readJson<RevisionInfo[]>(file(context, project.id, "index.json"), [])).filter((item) => item.createdAt >= cutoff && item.revision <= project.revision);
}

export async function revisionDocument(context: OwnerContext, project: Project, revision: number) {
  if (!(await revisionList(context, project)).some((item) => item.revision === revision)) throw new HTTPException(404, { message: "That revision is outside your available history." });
  if (context.db) {
    const result = await context.db.query("SELECT document FROM portfi_revisions WHERE owner_id=$1 AND project_id=$2 AND revision=$3", [context.user.id, project.id, revision]);
    if (!result.rows[0]) throw new HTTPException(404);
    return projectSchema.parse(result.rows[0].document);
  }
  return projectSchema.parse(JSON.parse(await readFile(file(context, project.id, `${revision}.json`), "utf8")));
}
