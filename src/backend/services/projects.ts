import { HTTPException } from "hono/http-exception";
import { rm } from "node:fs/promises";
import path from "node:path";
import { createProject, projectSchema, type Project, type TemplateId } from "@/shared/portfolio/schema";
import type { ProjectSummary } from "@/shared/contracts/workspace";
import { activeProjectCount, checkDocument, entitlements, reserveProject } from "@/backend/billing/entitlements";
import { checkpoint, revisionDocument, revisionList } from "./project-history";
import { atomicJson, dataPath, localProjects, localProjectsFile, ownerKey, withOwner, type OwnerContext } from "./workspace-store";
import type { Identity } from "./identity";
import { documentBytes } from "./storage-usage";
export { identity, guestEnabled, type Identity } from "./identity";

export async function projectIds(context: OwnerContext): Promise<string[]> {
  if (!context.db) return (await localProjects(context.user)).map((project) => project.id);
  return (await context.db.query("SELECT id FROM portfi_projects WHERE owner_id=$1", [context.user.id])).rows.map((row) => row.id);
}

export async function readInContext(context: OwnerContext, id: string, includeTrash = false): Promise<Project> {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new HTTPException(404);
  let document: unknown;
  if (context.db) document = (await context.db.query("SELECT document FROM portfi_projects WHERE owner_id=$1 AND id=$2", [context.user.id, id])).rows[0]?.document;
  else document = (await localProjects(context.user)).find((project) => project.id === id);
  if (!document || (!includeTrash && context.state.metadata[id]?.trashedAt)) throw new HTTPException(404, { message: "That portfolio wasn't found in your workspace." });
  return projectSchema.parse(document);
}

export async function listProjects(user: Identity): Promise<ProjectSummary[]> {
  return withOwner(user, async (context) => {
    const rows: { document: Project; updated_at?: string }[] = context.db
      ? (await context.db.query("SELECT jsonb_build_object('id',id,'name',document->'name','template',document->'template','revision',revision,'profile',document->'profile','theme',document->'theme','pages',(SELECT jsonb_agg(jsonb_build_object('id',p->'id','name',p->'name','slug',p->'slug')) FROM jsonb_array_elements(document->'pages') p)) AS document, updated_at FROM portfi_projects WHERE owner_id=$1 ORDER BY updated_at DESC", [user.id])).rows
      : (await localProjects(user)).map((document) => ({ document }));
    return rows.map(({ document, updated_at }) => ({ id: document.id, name: document.name, template: document.template, revision: document.revision, profile: document.profile, theme: document.theme, pages: document.pages.map(({ id, name, slug }) => ({ id, name, slug })), archivedAt: context.state.metadata[document.id]?.archivedAt || null, trashedAt: context.state.metadata[document.id]?.trashedAt || null, updatedAt: context.state.metadata[document.id]?.updatedAt || (updated_at ? new Date(updated_at).toISOString() : null) }));
  });
}
export async function readProject(user: Identity, id: string) { return withOwner(user, (context) => readInContext(context, id)); }

async function writeDocument(context: OwnerContext, project: Project, expectedRevision: number | null, label: string) {
  const value = projectSchema.parse(project);
  const documents = await documentBytes(context, value.id);
  const total = documents + Buffer.byteLength(JSON.stringify(value)) + context.state.assets.reduce((sum, item) => sum + item.size, 0);
  const limit = entitlements(context).storageMB * 1024 * 1024;
  if (total > limit) {
    const previous = expectedRevision === null ? null : await readInContext(context, value.id, true);
    if (!previous || Buffer.byteLength(JSON.stringify(value)) > Buffer.byteLength(JSON.stringify(previous))) throw new HTTPException(403, { message: "Your workspace storage is full. Remove unused media or reduce the document before saving more content." });
  }
  const assets = JSON.stringify(value).match(/\/api\/assets\/[a-f0-9-]{36}/g) || [];
  if (assets.some((url) => !context.state.assets.some((asset) => asset.id === url.slice(12) && asset.status === "ready"))) throw new HTTPException(403, { message: "An image is not available in this workspace. Upload it again or choose an image from your library." });
  if (context.db) {
    if (expectedRevision === null) await context.db.query("INSERT INTO portfi_projects(id,owner_id,document,revision) VALUES($1,$2,$3,$4)", [value.id, context.user.id, JSON.stringify(value), value.revision]);
    else {
      const result = await context.db.query("UPDATE portfi_projects SET document=$1,revision=$2,updated_at=now() WHERE id=$3 AND owner_id=$4 AND revision=$5", [JSON.stringify(value), value.revision, value.id, context.user.id, expectedRevision]);
      if (!result.rowCount) throw new HTTPException(409, { message: "This portfolio changed in another tab. Download your draft or reload the latest version." });
    }
  } else {
    const projects = await localProjects(context.user);
    const index = projects.findIndex((item) => item.id === value.id);
    if (expectedRevision !== null && (index < 0 || projects[index].revision !== expectedRevision)) throw new HTTPException(409, { message: "This portfolio changed in another tab. Download your draft or reload the latest version." });
    if (index < 0) projects.unshift(value); else projects[index] = value;
    await atomicJson(localProjectsFile(context.user), projects);
  }
  context.state.metadata[value.id] = { ...(context.state.metadata[value.id] || { archivedAt: null, trashedAt: null }), updatedAt: new Date().toISOString() };
  await checkpoint(context, value, label);
  return value;
}

export async function addProject(user: Identity, template: TemplateId) {
  return withOwner(user, async (context) => {
    reserveProject(context, await projectIds(context));
    const project = createProject(template);
    checkDocument(context, project);
    project.revision = 1;
    return writeDocument(context, project, null, "Created portfolio");
  });
}
export async function importProject(user: Identity, input: Project) {
  return withOwner(user, async (context) => {
    reserveProject(context, await projectIds(context));
    const copy = cloneProject(input);
    checkDocument(context, copy);
    return writeDocument(context, copy, null, "Imported backup");
  });
}

export function cloneProject(project: Project): Project {
  const ids = new Map(project.pages.map((page) => [page.id, crypto.randomUUID()]));
  const props = <T extends Project["pages"][number]["blocks"][number]["props"] | Project["pages"][number]["blocks"][number]["props"]["columnsContent"][number]["content"]>(value: T): T => ({ ...structuredClone(value), id: crypto.randomUUID(), items: value.items.map((item) => ({ ...item, ...(item.pageId ? { pageId: ids.get(item.pageId) || item.pageId } : {}) })) });
  return projectSchema.parse({ ...structuredClone(project), id: crypto.randomUUID(), revision: 1, name: `${project.name.slice(0, 90)} copy`, pages: project.pages.map((page) => ({ ...structuredClone(page), id: ids.get(page.id), blocks: page.blocks.map((block) => ({ ...structuredClone(block), props: { ...props(block.props), columnsContent: block.props.columnsContent.map((child) => ({ ...child, content: props(child.content) })) } })) })), redirects: project.redirects.map((redirect) => ({ ...redirect, toPageId: ids.get(redirect.toPageId) })) });
}

export async function saveProject(user: Identity, document: Project, expectedRevision: number) {
  return withOwner(user, async (context) => {
    const previous = await readInContext(context, document.id);
    if (context.state.metadata[document.id]?.archivedAt) throw new HTTPException(403, { message: "Restore this archived portfolio before editing." });
    if (previous.revision !== expectedRevision) throw new HTTPException(409, { message: "This portfolio changed in another tab. Download your draft or reload the latest version." });
    checkDocument(context, document, previous);
    return writeDocument(context, { ...document, revision: expectedRevision + 1 }, expectedRevision, "Saved changes");
  });
}

export async function projectAction(user: Identity, id: string, action: "rename" | "duplicate" | "archive" | "unarchive" | "trash" | "restore" | "free-copy" | "purge", expectedRevision: number, name?: string) {
  return withOwner(user, async (context) => {
    const project = await readInContext(context, id, action === "restore" || action === "purge");
    if (project.revision !== expectedRevision) throw new HTTPException(409, { message: "This portfolio changed. Refresh your workspace before trying again." });
    const metadata = context.state.metadata[id] ||= { archivedAt: null, trashedAt: null, updatedAt: new Date().toISOString() };
    if (action === "purge") {
      if (!metadata.trashedAt) throw new HTTPException(400, { message: "Move the portfolio to trash before deleting it permanently." });
      if (context.db) {
        const running = await context.db.query("SELECT id FROM portfi_publish_jobs WHERE owner_id=$1 AND project_id=$2 AND (status IN ('running','queued','retrying') OR (status='needs_attention' AND state->>'deploymentSubmitted'='true'))", [user.id, id]);
        if (running.rowCount) throw new HTTPException(409, { message: "Cancel the active publish job and wait for it to stop before deleting this portfolio." });
        await context.db.query("DELETE FROM portfi_publish_jobs WHERE owner_id=$1 AND project_id=$2", [user.id, id]);
        await context.db.query("DELETE FROM portfi_projects WHERE owner_id=$1 AND id=$2", [user.id, id]);
      } else {
        await atomicJson(localProjectsFile(user), (await localProjects(user)).filter((project) => project.id !== id));
        const base = path.resolve(dataPath("revisions", ownerKey(user)));
        const target = path.resolve(base, id);
        if (!target.startsWith(base + path.sep)) throw new Error("Revision cleanup must stay inside the owner's history directory.");
        await rm(target, { recursive: true, force: true });
      }
      delete context.state.metadata[id];
      return project;
    }
    if (action === "duplicate" || action === "free-copy") {
      const copy = cloneProject(project);
      if (action === "free-copy") {
        metadata.archivedAt = new Date().toISOString();
        copy.name = `${project.name.slice(0, 80)} — Free copy`;
        copy.template = "studio"; copy.theme.footerCredit = true; if (copy.theme.font === "custom") copy.theme.font = "sans"; copy.theme.customFont = ""; copy.pages = copy.pages.slice(0, 3);
        if (!copy.pages.some((page) => !page.slug)) copy.pages[0].slug = "";
        const ids = new Set(copy.pages.map((page) => page.id));
        copy.redirects = copy.redirects.filter((redirect) => ids.has(redirect.toPageId) && !copy.pages.some((page) => page.slug === redirect.from));
        for (const page of copy.pages) for (const block of page.blocks) for (const props of [block.props, ...block.props.columnsContent.map((child) => child.content)]) {
          props.responsive = { tablet: {}, mobile: {} }; props.hover = "none"; props.delay = 0;
          if (props.animation === "stagger") props.animation = "rise";
          props.items = props.items.map((item) => item.pageId && !ids.has(item.pageId) ? { ...item, pageId: undefined, url: "" } : item);
        }
      }
      reserveProject(context, await projectIds(context)); checkDocument(context, copy);
      return writeDocument(context, copy, null, action === "free-copy" ? "Free-compatible copy" : "Duplicated portfolio");
    }
    if ((action === "unarchive" || action === "restore") && (metadata.archivedAt || metadata.trashedAt)) reserveProject(context, await projectIds(context));
    if (action === "archive") metadata.archivedAt = new Date().toISOString();
    if (action === "unarchive") metadata.archivedAt = null;
    if (action === "trash") metadata.trashedAt = new Date().toISOString();
    if (action === "restore") { metadata.trashedAt = null; metadata.archivedAt = null; }
    return writeDocument(context, { ...project, name: action === "rename" ? name! : project.name, revision: expectedRevision + 1 }, expectedRevision, `Portfolio ${action}`);
  });
}

export async function projectHistory(user: Identity, id: string) { return withOwner(user, async (context) => revisionList(context, await readInContext(context, id))); }
export async function restoreRevision(user: Identity, id: string, revision: number, expectedRevision: number) {
  return withOwner(user, async (context) => {
    const current = await readInContext(context, id);
    if (current.revision !== expectedRevision) throw new HTTPException(409, { message: "The portfolio changed while history was open. Refresh before restoring." });
    if (context.state.metadata[id]?.archivedAt) throw new HTTPException(403, { message: "Unarchive the portfolio before restoring a revision." });
    const snapshot = await revisionDocument(context, current, revision);
    checkDocument(context, snapshot, current);
    await checkpoint(context, current, "Before restoring a revision");
    return writeDocument(context, { ...snapshot, revision: expectedRevision + 1 }, expectedRevision, `Restored revision ${revision}`);
  });
}

export async function saveNamedVersion(user: Identity, id: string, expectedRevision: number, label: string) {
  return withOwner(user, async (context) => {
    if (!entitlements(context).historyDays && user.mode !== "guest") throw new HTTPException(403, { message: "Version history is available on Creator and Pro." });
    const project = await readInContext(context, id);
    if (project.revision !== expectedRevision) throw new HTTPException(409, { message: "Save your changes before creating a named version." });
    await checkpoint(context, project, label, true);
    return { saved: true };
  });
}
export async function authorizeExport(user: Identity, id: string) {
  return withOwner(user, async (context) => {
    const project = await readInContext(context, id);
    if (context.state.metadata[id]?.archivedAt) throw new HTTPException(403, { message: "Unarchive this portfolio before exporting or publishing." });
    if (activeProjectCount(context, await projectIds(context)) > entitlements(context).portfolios) throw new HTTPException(403, { message: "Your current plan has fewer active portfolio slots. Archive the extra portfolios before publishing; all work stays saved." });
    checkDocument(context, project, undefined, true);
    return project;
  });
}
