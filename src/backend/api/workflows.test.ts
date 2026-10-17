import { mkdtemp, mkdir, rm, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import JSZip from "jszip";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "./index";
import { newBlock, projectSchema, type Project } from "@/shared/portfolio/schema";
import { dataPath, ownerKey, withOwner } from "@/backend/services/workspace-store";
import { reapPendingAssets } from "@/backend/services/assets";
import type { Identity } from "@/backend/services/identity";

const cookie = () => `portfi_workspace=${randomBytes(32).toString("hex")}`;
const root = path.resolve(".portfi", "test-runs");
let directory: string;
beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", ""); vi.stubEnv("BETTER_AUTH_SECRET", ""); vi.stubEnv("PORTFI_DISABLE_GUEST", "false");
  await mkdir(root, { recursive: true }); directory = await mkdtemp(path.join(root, "workflows-"));
  vi.stubEnv("PORTFI_DATA_DIR", directory);
});
afterAll(async () => {
  if (!path.resolve(directory).startsWith(root + path.sep)) throw new Error("Test cleanup must remain in its fixture directory.");
  await rm(directory, { recursive: true, force: true }); vi.unstubAllEnvs();
});
async function request(owner: string, route: string, method = "GET", body?: unknown) {
  return app.request(`/api${route}`, { method, headers: { cookie: owner, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
async function create(owner: string) {
  const response = await request(owner, "/projects", "POST", { template: "studio" });
  expect(response.status).toBe(201);
  return (await response.json() as { project: Project }).project;
}

describe("workspace HTTP workflows", () => {
  it("renames, duplicates, archives, trashes, and restores without losing the portfolio", async () => {
    const owner = cookie(); let project = await create(owner);
    project.pages[0].blocks.push(newBlock("Columns"));
    const saved = await request(owner, `/projects/${project.id}`, "PUT", { project, expectedRevision: project.revision });
    project = (await saved.json() as { project: Project }).project;
    const action = async (value: string, extra = {}) => {
      const result = await request(owner, `/projects/${project.id}/action`, "POST", { action: value, expectedRevision: project.revision, ...extra });
      expect(result.status).toBe(200); return (await result.json() as { project: Project }).project;
    };
    project = await action("rename", { name: "My complete portfolio" });
    expect(project.name).toBe("My complete portfolio");
    const copy = await action("duplicate");
    expect(copy.id).not.toBe(project.id);
    expect(copy.pages[0].blocks.at(-1)!.props.columnsContent[0].content.id).not.toBe(project.pages[0].blocks.at(-1)!.props.columnsContent[0].content.id);
    project = await action("archive");
    expect((await request(owner, `/projects/${project.id}`, "PUT", { project, expectedRevision: project.revision })).status).toBe(403);
    project = await action("unarchive"); project = await action("trash");
    expect((await request(owner, `/projects/${project.id}`)).status).toBe(404);
    project = await action("restore");
    expect((await request(owner, `/projects/${project.id}`)).status).toBe(200);
    expect((await request(cookie(), `/projects/${project.id}/action`, "POST", { action: "rename", name: "Stolen", expectedRevision: project.revision })).status).toBe(404);
    expect((await request(owner, `/projects/${project.id}/action`, "POST", { action: "purge", expectedRevision: project.revision })).status).toBe(400);
    project = await action("trash"); await action("purge");
    expect((await request(owner, `/projects/${project.id}/action`, "POST", { action: "restore", expectedRevision: project.revision })).status).toBe(404);
    expect((await request(owner, `/projects/${copy.id}`)).status).toBe(200);
  });

  it("protects concurrent writes and restores immutable history as a new revision", async () => {
    const owner = cookie(); const initial = await create(owner);
    const named = await request(owner, `/projects/${initial.id}/history/checkpoint`, "POST", { expectedRevision: initial.revision, label: "First direction" });
    expect(named.status).toBe(200);
    const namedList = await (await request(owner, `/projects/${initial.id}/history`)).json() as { revisions: { label: string }[] };
    expect(namedList.revisions[0].label).toBe("First direction");
    const next = { ...initial, name: "A later direction" };
    const results = await Promise.all([request(owner, `/projects/${initial.id}`, "PUT", { project: next, expectedRevision: initial.revision }), request(owner, `/projects/${initial.id}`, "PUT", { project: { ...initial, name: "Other tab" }, expectedRevision: initial.revision })]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    const latest = (await (await request(owner, `/projects/${initial.id}`)).json() as { project: Project }).project;
    const restored = await request(owner, `/projects/${initial.id}/history/restore`, "POST", { revision: 1, expectedRevision: latest.revision });
    expect(restored.status).toBe(200);
    const project = (await restored.json() as { project: Project }).project;
    expect(project.name).toBe(initial.name); expect(project.revision).toBe(3);
    const history = await (await request(owner, `/projects/${initial.id}/history`)).json() as { revisions: { revision: number }[] };
    expect(history.revisions.map((item) => item.revision)).toEqual([3, 2, 1]);
    expect((await request(cookie(), `/projects/${initial.id}/history`)).status).toBe(404);
  });

  it("reserves active project slots atomically under concurrent creation", async () => {
    const owner = cookie();
    const responses = await Promise.all(Array.from({ length: 12 }, () => request(owner, "/projects", "POST", { template: "studio" })));
    expect(responses.filter((response) => response.status === 201)).toHaveLength(10);
    expect(responses.filter((response) => response.status === 403)).toHaveLength(2);
  });

  it("owns uploaded assets and packages local image bytes into an independent export", async () => {
    const owner = cookie(); let project = await create(owner);
    const png = `data:image/png;base64,${(await sharp({ create: { width: 4, height: 4, channels: 3, background: "#ffffff" } }).png().toBuffer()).toString("base64")}`;
    const uploaded = await request(owner, "/assets", "POST", { name: "a-small-image.png", data: png });
    expect(uploaded.status).toBe(201);
    const { asset } = await uploaded.json() as { asset: { id: string; path: string } };
    expect((await request(owner, `/assets/${asset.id}`)).headers.get("content-type")).toBe("image/png");
    expect((await request(cookie(), `/assets/${asset.id}`)).status).toBe(404);
    project.pages[0].blocks[1].props.items[0].image = asset.path;
    const saved = await request(owner, `/projects/${project.id}`, "PUT", { project, expectedRevision: project.revision });
    expect(saved.status).toBe(200); project = (await saved.json() as { project: Project }).project;
    expect((await request(owner, `/assets/${asset.id}`, "DELETE")).status).toBe(409);
    const exported = await request(owner, `/projects/${project.id}/export`, "POST");
    expect(exported.status).toBe(200);
    const archive = await JSZip.loadAsync(await exported.arrayBuffer());
    expect(archive.file(`public/assets/uploads/${asset.id}.png`)).not.toBeNull();
    const content = await archive.file("portfolio/project.json")!.async("string");
    expect(content).not.toContain("/api/assets/"); expect(projectSchema.safeParse(JSON.parse(content)).success).toBe(true);
    const foreign = await request(cookie(), "/projects/import", "POST", { project });
    expect(foreign.status).toBe(403);
  });

  it("rejects fake image data and executable imported links", async () => {
    const owner = cookie();
    expect((await request(owner, "/assets", "POST", { name: "fake.png", data: "data:image/png;base64,PHN2Zz4=" })).status).toBe(400);
    const project = await create(owner); project.pages[0].blocks[1].props.items[0].url = "javascript:alert(1)";
    expect((await request(owner, "/projects/import", "POST", { project })).status).toBe(400);
  });

  it("reclaims abandoned upload reservations without removing recent or ready assets", async () => {
    const user: Identity = { id: randomBytes(32).toString("hex"), mode: "guest", name: "", email: "", verified: false };
    const key = ownerKey(user); const now = Date.now();
    await mkdir(dataPath("assets", key), { recursive: true });
    await writeFile(dataPath("assets", key, "expired.png"), "partial image");
    await writeFile(dataPath("assets", key, "expired-640.webp"), "partial variant");
    await withOwner(user, async ({ state }) => {
      state.assets = ["expired", "recent", "ready"].map((id) => ({ id, name: id, size: 10, type: "image/png", path: `${key}/${id}.png`, createdAt: new Date(id === "recent" ? now : now - 3 * 60 * 60_000).toISOString(), status: id === "ready" ? "ready" : "pending", variants: id === "expired" ? [{ width: 640, path: `${key}/expired-640.webp`, size: 10 }] : [] }));
    });
    expect(await reapPendingAssets(user, now)).toBe(1);
    await expect(access(dataPath("assets", key, "expired.png"))).rejects.toThrow();
    await expect(access(dataPath("assets", key, "expired-640.webp"))).rejects.toThrow();
    expect(await withOwner(user, async ({ state }) => state.assets.map((asset) => asset.id))).toEqual(["recent", "ready"]);
  });
});
