import { Hono } from "hono";
import { validator } from "hono/validator";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { projectSchema } from "@/shared/portfolio/schema";
import { identity } from "@/backend/services/identity";
import { addProject, authorizeExport, importProject, listProjects, projectAction, projectHistory, readInContext, readProject, restoreRevision, saveNamedVersion, saveProject } from "@/backend/services/projects";
import { revisionDocument } from "@/backend/services/project-history";
import { withOwner } from "@/backend/services/workspace-store";
import { portableAssets } from "@/backend/services/assets";
import { exportProject } from "@/backend/publishing/exporter";

function valid<T extends z.ZodType>(schema: T) {
  return validator("json", (value) => {
    const parsed = schema.safeParse(value);
    if (!parsed.success) throw new HTTPException(400, { message: parsed.error.issues[0]?.message || "Some settings are invalid." });
    return parsed.data as z.infer<T>;
  });
}
const revision = z.number().int().nonnegative();

export const projectRoutes = new Hono()
  .get("/", async (c) => c.json({ projects: await listProjects(await identity(c)) }))
  .post("/", valid(z.object({ template: z.enum(["studio", "developer", "editorial", "professional"]) })), async (c) => c.json({ project: await addProject(await identity(c), c.req.valid("json").template) }, 201))
  .post("/import", valid(z.object({ project: projectSchema })), async (c) => c.json({ project: await importProject(await identity(c), c.req.valid("json").project) }, 201))
  .get("/:id", async (c) => c.json({ project: await readProject(await identity(c), c.req.param("id")) }))
  .put("/:id", valid(z.object({ project: projectSchema, expectedRevision: revision })), async (c) => {
    const input = c.req.valid("json");
    if (input.project.id !== c.req.param("id")) throw new HTTPException(400, { message: "Portfolio ID does not match." });
    return c.json({ project: await saveProject(await identity(c), input.project, input.expectedRevision) });
  })
  .post("/:id/action", valid(z.object({ action: z.enum(["rename", "duplicate", "archive", "unarchive", "trash", "restore", "free-copy", "purge"]), expectedRevision: revision, name: z.string().trim().min(1).max(100).optional() }).refine((value) => value.action !== "rename" || Boolean(value.name), "Give the portfolio a name.")), async (c) => {
    const input = c.req.valid("json");
    return c.json({ project: await projectAction(await identity(c), c.req.param("id"), input.action, input.expectedRevision, input.name) });
  })
  .get("/:id/history", async (c) => c.json({ revisions: await projectHistory(await identity(c), c.req.param("id")) }))
  .post("/:id/history/checkpoint", valid(z.object({ expectedRevision: revision, label: z.string().trim().min(1).max(80) })), async (c) => { const input = c.req.valid("json"); return c.json(await saveNamedVersion(await identity(c), c.req.param("id"), input.expectedRevision, input.label)); })
  .get("/:id/history/:revision", async (c) => {
    const user = await identity(c);
    const project = await withOwner(user, async (context) => revisionDocument(context, await readInContext(context, c.req.param("id")), Number(c.req.param("revision"))));
    return c.json({ project });
  })
  .post("/:id/history/restore", valid(z.object({ revision, expectedRevision: revision })), async (c) => {
    const input = c.req.valid("json");
    return c.json({ project: await restoreRevision(await identity(c), c.req.param("id"), input.revision, input.expectedRevision) });
  })
  .post("/:id/export", async (c) => {
    const user = await identity(c);
    const { project, files } = await portableAssets(user, await authorizeExport(user, c.req.param("id")));
    const archive = await exportProject(project, files);
    return new Response(new Uint8Array(archive), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="portfi-${project.id.slice(0, 8)}.zip"`, "Cache-Control": "no-store" } });
  });

export { valid };
