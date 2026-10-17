import { Hono } from "hono";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { blockSchema, projectSchema } from "@/shared/portfolio/schema";
import { identity } from "@/backend/services/identity";
import { entitlements } from "@/backend/billing/entitlements";
import { addAsset, assetBytes, deleteAsset, listAssets, storageReady } from "@/backend/services/assets";
import { withOwner } from "@/backend/services/workspace-store";
import { projectIds } from "@/backend/services/projects";
import { storageBytes } from "@/backend/services/storage-usage";
import { valid } from "./project-routes";

export const workspaceRoutes = new Hono()
  .get("/workspace", async (c) => c.json(await withOwner(await identity(c), async (context) => {
    const ids = await projectIds(context);
    const plan = entitlements(context);
    return { plan, usage: { activePortfolios: ids.filter((id) => !context.state.metadata[id]?.archivedAt && !context.state.metadata[id]?.trashedAt).length, storageBytes: await storageBytes(context) }, subscription: context.state.subscription ? { status: context.state.subscription.status, plan: context.state.subscription.plan } : null, storageReady: context.user.mode === "guest" || storageReady() };
  })))
  .get("/assets", async (c) => c.json({ assets: await listAssets(await identity(c)) }))
  .post("/assets", valid(z.object({ name: z.string().max(160), data: z.string().max(1_500_000) })), async (c) => {
    const input = c.req.valid("json");
    return c.json({ asset: await addAsset(await identity(c), input.name, input.data) }, 201);
  })
  .get("/assets/:id", async (c) => {
    const width = c.req.query("width") ? z.enum(["640", "960"]).parse(c.req.query("width")) : undefined;
    const { asset, buffer } = await assetBytes(await identity(c), c.req.param("id"), width ? Number(width) : undefined);
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": asset.type, "Content-Length": String(buffer.length), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  })
  .delete("/assets/:id", async (c) => { await deleteAsset(await identity(c), c.req.param("id")); return c.json({ deleted: true }); })
  .get("/sections", async (c) => c.json(await withOwner(await identity(c), async (context) => ({ sections: entitlements(context).library ? context.state.sections : [], locked: !entitlements(context).library }))))
  .post("/sections", valid(z.object({ name: z.string().trim().min(1).max(80), block: blockSchema })), async (c) => {
    const input = c.req.valid("json");
    return c.json(await withOwner(await identity(c), async (context) => {
      if (!entitlements(context).library) throw new HTTPException(403, { message: "Reusable sections are available on Pro." });
      if (context.state.sections.length >= 100) throw new HTTPException(403, { message: "Your section library supports up to 100 saved sections." });
      const section = { id: crypto.randomUUID(), ...input };
      const references = JSON.stringify(input.block).match(/\/api\/assets\/[a-f0-9-]{36}/g) || [];
      if (references.some((url) => !context.state.assets.some((asset) => asset.id === url.slice(12) && asset.status === "ready"))) throw new HTTPException(403, { message: "This section contains an unavailable image." });
      context.state.sections.push(section);
      return { section };
    }), 201);
  })
  .delete("/sections/:id", async (c) => c.json(await withOwner(await identity(c), async ({ state }) => { state.sections = state.sections.filter((section) => section.id !== c.req.param("id")); return { deleted: true }; })))
  .get("/themes", async (c) => c.json(await withOwner(await identity(c), async (context) => ({ themes: entitlements(context).library ? context.state.themes || [] : [], locked: !entitlements(context).library }))))
  .post("/themes", valid(z.object({ name: z.string().trim().min(1).max(80), theme: projectSchema.shape.theme })), async (c) => {
    const input = c.req.valid("json");
    return c.json(await withOwner(await identity(c), async (context) => {
      if (!entitlements(context).library) throw new HTTPException(403, { message: "Reusable themes are available on Pro." });
      const themes = context.state.themes ||= [];
      if (themes.length >= 50) throw new HTTPException(403, { message: "The theme library supports up to 50 themes." });
      if (input.theme.customFont.startsWith("/api/assets/") && !context.state.assets.some((asset) => asset.id === input.theme.customFont.slice(12) && asset.type === "font/woff2" && asset.status === "ready")) throw new HTTPException(403, { message: "The theme font is not in this workspace." });
      const theme = { id: crypto.randomUUID(), ...input }; themes.push(theme);
      return { theme };
    }), 201);
  })
  .delete("/themes/:id", async (c) => c.json(await withOwner(await identity(c), async ({ state }) => { state.themes = (state.themes || []).filter((theme) => theme.id !== c.req.param("id")); return { deleted: true }; })));
