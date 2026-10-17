import { Hono } from "hono";
import { z } from "zod";
import { identity } from "@/backend/services/identity";
import { beginConnection, completeConnection, connectionList, disconnect } from "@/backend/publishing/connections";
import { jobAction, listJobs, queuePublish } from "@/backend/publishing/jobs";
import { valid } from "./project-routes";

const provider = z.enum(["github", "vercel"]);
export const publishingRoutes = new Hono()
  .get("/connections", async (c) => {
    const user = await identity(c);
    return c.json(user.mode === "guest" ? { github: null, vercel: null, configured: { github: false, vercel: false }, installUrl: null } : await connectionList(user));
  })
  .post("/connections/:provider/connect", async (c) => c.json(await beginConnection(c, await identity(c, false), provider.parse(c.req.param("provider")))))
  .get("/connections/:provider/callback", async (c) => {
    const name = provider.parse(c.req.param("provider"));
    await completeConnection(c, await identity(c, false), name);
    return c.redirect(`/settings?connected=${name}`);
  })
  .delete("/connections/:provider", async (c) => { await disconnect(await identity(c, false), provider.parse(c.req.param("provider"))); return c.json({ disconnected: true }); })
  .get("/projects/:id/publishing", async (c) => c.json({ jobs: await listJobs(await identity(c, false), c.req.param("id")) }))
  .post("/projects/:id/publishing", valid(z.object({ expectedRevision: z.number().int().nonnegative(), repositoryName: z.string().min(1).max(80), idempotencyKey: z.string().uuid() })), async (c) => {
    const input = c.req.valid("json");
    return c.json({ job: await queuePublish(await identity(c, false), c.req.param("id"), input.expectedRevision, input.repositoryName, input.idempotencyKey) }, 202);
  })
  .post("/publishing/:id/action", valid(z.object({ action: z.enum(["retry", "cancel"]) })), async (c) => c.json({ job: await jobAction(await identity(c, false), c.req.param("id"), c.req.valid("json").action) }));
