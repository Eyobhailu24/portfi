import { createHash } from "node:crypto";
import { HTTPException } from "hono/http-exception";
import type { Identity } from "@/backend/services/identity";
import { connectionToken } from "./connections";

export type SourceFile = { name: string; buffer: Buffer };
export class ProviderError extends Error {
  constructor(message: string, public status: number, public uncertain = false) { super(message); }
}
async function request<T>(origin: string, access: string, route: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try { response = await fetch(`${origin}${route}`, { ...init, headers: { Authorization: `Bearer ${access}`, Accept: "application/json", "Content-Type": "application/json", "User-Agent": "Portfi", ...(origin.includes("github") ? { "X-GitHub-Api-Version": "2026-03-10" } : {}), ...init.headers }, signal: AbortSignal.timeout(25_000) }); }
  catch { throw new ProviderError("The provider did not respond. We will check its state before trying again.", 503, true); }
  if (!response.ok) {
    const message = response.status === 401 || response.status === 403 ? "The provider needs renewed access. Reconnect it and check repository/project permissions." : response.status === 429 ? "The provider is busy. Please wait before retrying." : "The provider rejected this step. Check account permissions, repository access, and provider limits.";
    throw new ProviderError(message, response.status, response.status >= 500);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
const segment = (value: string) => encodeURIComponent(value);
export const validRepoName = (name: string) => /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(name) && !name.endsWith(".git");

export async function githubClient(user: Identity) {
  const token = await connectionToken(user, "github");
  const get = <T>(route: string, init?: RequestInit) => request<T>("https://api.github.com", token.access, route, init);
  return {
    account: token.account,
    async ensureRepository(name: string, projectId: string, jobId: string) {
      if (!validRepoName(name)) throw new HTTPException(400, { message: "Choose a valid repository name." });
      const route = `/repos/${segment(token.account)}/${segment(name)}`;
      let repository: { id: number; full_name: string; default_branch: string; description: string };
      try { repository = await get(route); }
      catch (error) {
        if (!(error instanceof ProviderError) || error.status !== 404) throw error;
        repository = await get("/user/repos", { method: "POST", body: JSON.stringify({ name, private: true, auto_init: true, description: `Portfi portfolio ${projectId}; setup ${jobId}`, has_issues: false, has_wiki: false }) });
      }
      if (repository.description !== `Portfi portfolio ${projectId}; setup ${jobId}`) {
        const marker = await get<{ content?: string }>(`${route}/contents/.portfi-project.json`).catch(() => null);
        let parsed: { projectId?: string } = {};
        try { parsed = JSON.parse(Buffer.from(marker?.content || "", "base64").toString("utf8")); } catch {}
        if (parsed.projectId !== projectId) throw new ProviderError("This repository is not managed by this Portfi portfolio. Choose an unused name so existing code stays safe.", 409);
      }
      return repository;
    },
    async commit(repository: { full_name: string; default_branch: string }, files: SourceFile[], projectId: string, jobId: string, expectedHead?: string, createdAt = new Date().toISOString()) {
      const route = `/repos/${repository.full_name.split("/").map(segment).join("/")}`;
      const branch = segment(repository.default_branch);
      const ref = await get<{ object: { sha: string } }>(`${route}/git/ref/heads/${branch}`);
      const current = await get<{ sha: string; tree: { sha: string }; message: string }>(`${route}/git/commits/${ref.object.sha}`);
      const message = `Portfi ${projectId} · ${jobId}`;
      if (current.message === message) return current.sha;
      if (expectedHead && expectedHead !== current.sha) throw new ProviderError("This repository changed outside Portfi. Export your draft and review the repository before publishing again; external edits will not be overwritten.", 409);
      let managed: string[] = [];
      try {
        const marker = await get<{ content: string }>(`${route}/contents/.portfi-project.json?ref=${branch}`);
        const parsed = JSON.parse(Buffer.from(marker.content, "base64").toString("utf8"));
        if (parsed.projectId !== projectId) throw new Error("Wrong portfolio");
        managed = parsed.files;
      } catch (error) { if (!(error instanceof ProviderError && error.status === 404) && expectedHead) throw error; }
      const source = [...files, { name: ".portfi-project.json", buffer: Buffer.from(JSON.stringify({ projectId, files: files.map((file) => file.name) })) }];
      const tree: { path: string; mode: string; type: string; sha: string | null }[] = [];
      // Bounded batches keep network requests off the main editor path and avoid
      // flooding provider APIs for image-rich portfolios.
      for (let i = 0; i < source.length; i += 4) {
        const blobs = await Promise.all(source.slice(i, i + 4).map(async (file) => {
          const blob = await get<{ sha: string }>(`${route}/git/blobs`, { method: "POST", body: JSON.stringify({ content: file.buffer.toString("base64"), encoding: "base64" }) });
          return { path: file.name, mode: "100644", type: "blob", sha: blob.sha };
        }));
        tree.push(...blobs);
      }
      for (const name of managed) if (!files.some((file) => file.name === name) && !name.includes("..")) tree.push({ path: name, mode: "100644", type: "blob", sha: null });
      const nextTree = await get<{ sha: string }>(`${route}/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: current.tree.sha, tree }) });
      const commit = await get<{ sha: string }>(`${route}/git/commits`, { method: "POST", body: JSON.stringify({ message, tree: nextTree.sha, parents: [current.sha], author: { name: "Portfi", email: "portfolio@users.noreply.github.com", date: createdAt } }) });
      await get(`${route}/git/refs/heads/${branch}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }) });
      return commit.sha;
    },
  };
}

export async function vercelClient(user: Identity) {
  const token = await connectionToken(user, "vercel");
  const get = <T>(route: string, init?: RequestInit) => request<T>("https://api.vercel.com", token.access, `${route}${route.includes("?") ? "&" : "?"}${token.teamId ? `teamId=${segment(token.teamId)}` : ""}`, init);
  return {
    async ensureProject(name: string, projectId: string) {
      const normalized = `portfi-${projectId.replaceAll("-", "").slice(0, 20)}`;
      try { return await get<{ id: string; name: string }>(`/v9/projects/${normalized}`); }
      catch (error) {
        if (!(error instanceof ProviderError) || error.status !== 404) throw error;
        return get<{ id: string; name: string }>("/v11/projects", { method: "POST", body: JSON.stringify({ name: normalized, framework: "nextjs", buildCommand: "npm run build", outputDirectory: "out" }) });
      }
    },
    async findDeployment(project: string, jobId: string) {
      const result = await get<{ deployments: { uid: string; url: string; state: string; meta?: Record<string, string> }[] }>(`/v6/deployments?projectId=${segment(project)}&limit=100`);
      const deployment = result.deployments.find((deployment) => deployment.meta?.portfiJob === jobId);
      return deployment ? { id: deployment.uid, url: deployment.url, readyState: deployment.state } : null;
    },
    async deploy(project: { id: string; name: string }, files: SourceFile[], jobId: string, commit: string) {
      const uploads = [];
      for (const file of files) {
        const sha = createHash("sha1").update(file.buffer).digest("hex");
        await get("/v2/files", { method: "POST", headers: { "Content-Type": "application/octet-stream", "x-vercel-digest": sha, "x-vercel-size": String(file.buffer.length) }, body: new Uint8Array(file.buffer) });
        uploads.push({ file: file.name, sha, size: file.buffer.length });
      }
      return get<{ id: string; url: string; readyState: string }>("/v13/deployments", { method: "POST", body: JSON.stringify({ name: project.name, project: project.id, target: "production", files: uploads, meta: { portfiJob: jobId, portfiCommit: commit }, projectSettings: { framework: "nextjs", buildCommand: "npm run build", outputDirectory: "out" } }) });
    },
    status(id: string) { return get<{ id: string; url: string; readyState: string; errorMessage?: string }>(`/v13/deployments/${segment(id)}`); },
    cancel(id: string) { return get(`/v12/deployments/${segment(id)}/cancel`, { method: "PATCH" }); },
  };
}
