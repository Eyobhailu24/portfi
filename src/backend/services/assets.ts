import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { HTTPException } from "hono/http-exception";
import { entitlements } from "@/backend/billing/entitlements";
import type { Project } from "@/shared/portfolio/schema";
import type { Identity } from "./identity";
import { dataPath, ownerKey, withOwner, type Asset } from "./workspace-store";
import { storageBytes } from "./storage-usage";
import { imageVariants } from "./image-variants";

export const storageReady = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_STORAGE_BUCKET);
const maxImageBytes = 1_100_000;
export function decodeImage(data: string) {
  const match = /^data:image\/(webp|png|jpeg);base64,([a-zA-Z0-9+/=]+)$/.exec(data);
  if (!match) throw new HTTPException(400, { message: "Choose a JPG, PNG, or WebP image." });
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > maxImageBytes) throw new HTTPException(413, { message: "Resize this image to less than 1 MB before uploading." });
  const png = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  const webp = buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  if (!(match[1] === "png" && png || match[1] === "jpeg" && jpeg || match[1] === "webp" && webp)) throw new HTTPException(400, { message: "This file does not match its image format." });
  return { buffer, type: `image/${match[1]}`, extension: match[1] === "jpeg" ? "jpg" : match[1] };
}

function decodeUpload(data: string) {
  if (!data.startsWith("data:font/woff2;base64,")) return decodeImage(data);
  const buffer = Buffer.from(data.slice("data:font/woff2;base64,".length), "base64");
  if (buffer.length > 400_000 || buffer.length < 48 || buffer.toString("ascii", 0, 4) !== "wOF2" || buffer.readUInt32BE(8) !== buffer.length) throw new HTTPException(400, { message: "Choose a valid WOFF2 font smaller than 400 KB." });
  return { buffer, type: "font/woff2", extension: "woff2" };
}

function storageUrl(object: string) {
  const url = new URL(process.env.SUPABASE_URL!);
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("SUPABASE_URL must use HTTPS.");
  return `${url.origin}/storage/v1/object/${encodeURIComponent(process.env.SUPABASE_STORAGE_BUCKET!)}/${object.split("/").map(encodeURIComponent).join("/")}`;
}
function headers() { return { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: process.env.SUPABASE_SERVICE_ROLE_KEY! }; }
async function removeStoredObject(object: string) {
  const url = new URL(storageUrl(object));
  return fetch(`${url.origin}/storage/v1/object/${encodeURIComponent(process.env.SUPABASE_STORAGE_BUCKET!)}`, { method: "DELETE", headers: { ...headers(), "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: [object] }), signal: AbortSignal.timeout(20_000) });
}

export async function listAssets(user: Identity) { return withOwner(user, async ({ state }) => state.assets.filter((asset) => asset.status === "ready").map((asset) => ({ ...asset, path: `/api/assets/${asset.id}` }))); }
export async function addAsset(user: Identity, name: string, data: string) {
  const image = decodeUpload(data);
  const variants = image.type.startsWith("image/") ? await imageVariants(image.buffer) : [];
  if (user.mode === "account" && !storageReady()) throw new HTTPException(503, { message: "Image storage needs Supabase settings in .env.local." });
  const asset: Asset = { id: crypto.randomUUID(), name, size: image.buffer.length, type: image.type, path: "", status: "pending", createdAt: new Date().toISOString() };
  asset.path = `${ownerKey(user)}/${asset.id}.${image.extension}`;
  asset.variants = variants.map((variant) => ({ width: variant.width, path: `${ownerKey(user)}/${asset.id}-${variant.width}.webp`, size: variant.buffer.length }));
  asset.size += variants.reduce((sum, variant) => sum + variant.buffer.length, 0);
  await withOwner(user, async (context) => {
    const plan = entitlements(context);
    if (await storageBytes(context) + asset.size > plan.storageMB * 1024 * 1024) throw new HTTPException(403, { message: `Your ${plan.name} storage is full. Remove unused assets or upgrade.` });
    if (context.state.assets.length >= 2000) throw new HTTPException(403, { message: "Your media library has reached its image limit." });
    context.state.assets.push(asset);
  });
  try {
    const objects = [{ path: asset.path, buffer: image.buffer, type: asset.type }, ...variants.map((variant) => ({ path: asset.variants!.find((item) => item.width === variant.width)!.path, buffer: variant.buffer, type: "image/webp" }))];
    for (const object of objects) {
      if (user.mode === "guest") {
        const file = dataPath("assets", object.path);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, object.buffer, { mode: 0o600, flag: "wx" });
      } else {
        const result = await fetch(storageUrl(object.path), { method: "POST", headers: { ...headers(), "Content-Type": object.type, "x-upsert": "false" }, body: new Uint8Array(object.buffer), signal: AbortSignal.timeout(20_000) });
        if (!result.ok) throw new HTTPException(502, { message: "The image could not be stored. Try uploading again." });
      }
    }
    await withOwner(user, async ({ state }) => { const stored = state.assets.find((item) => item.id === asset.id); if (stored) stored.status = "ready"; });
    return { ...asset, status: "ready" as const, path: `/api/assets/${asset.id}` };
  } catch (error) {
    const removed = (await Promise.all([asset.path, ...asset.variants!.map((item) => item.path)].map((object) => user.mode === "guest" ? unlink(dataPath("assets", object)).then(() => true).catch((error) => error.code === "ENOENT") : removeStoredObject(object).then((response) => response.ok || response.status === 404).catch(() => false)))).every(Boolean);
    if (removed) await withOwner(user, async ({ state }) => { state.assets = state.assets.filter((item) => item.id !== asset.id); });
    throw error;
  }
}

export async function assetBytes(user: Identity, id: string, width?: number): Promise<{ asset: Asset; buffer: Buffer }> {
  const asset = await withOwner(user, async ({ state }) => state.assets.find((asset) => asset.id === id && asset.status === "ready"));
  if (!asset) throw new HTTPException(404, { message: "Image not found in this workspace." });
  const variant = width ? asset.variants?.find((variant) => variant.width === width) : null;
  if (width && !variant && asset.type.startsWith("image/")) {
    const original = await assetBytes(user, id);
    const generated = (await imageVariants(original.buffer)).find((variant) => variant.width === width);
    if (!generated) throw new HTTPException(400, { message: "Unsupported image size." });
    return { asset: { ...asset, type: "image/webp" }, buffer: generated.buffer };
  }
  const objectPath = variant?.path || asset.path;
  if (variant) asset.type = "image/webp";
  if (user.mode === "guest") return { asset, buffer: await readFile(dataPath("assets", objectPath)) };
  if (!storageReady()) throw new HTTPException(503, { message: "Image storage is not configured." });
  const result = await fetch(storageUrl(objectPath), { headers: headers(), signal: AbortSignal.timeout(20_000) });
  if (!result.ok) throw new HTTPException(502, { message: "This image is temporarily unavailable." });
  return { asset, buffer: Buffer.from(await result.arrayBuffer()) };
}

export async function deleteAsset(user: Identity, id: string) {
  return withOwner(user, async (context) => {
    const asset = context.state.assets.find((asset) => asset.id === id);
    if (!asset) throw new HTTPException(404);
    // Revisions retain their asset references too; removal cannot break recoverable work.
    const marker = `/api/assets/${id}`;
    if (context.db) {
      const used = await context.db.query("SELECT 1 FROM portfi_projects WHERE owner_id=$1 AND document::text LIKE $2 UNION ALL SELECT 1 FROM portfi_revisions WHERE owner_id=$1 AND document::text LIKE $2 UNION ALL SELECT 1 FROM portfi_publish_jobs WHERE owner_id=$1 AND status IN ('queued','retrying','running','needs_attention') AND state::text LIKE $2 LIMIT 1", [user.id, `%${marker}%`]);
      if (used.rowCount) throw new HTTPException(409, { message: "This image is used by a portfolio or saved revision. Remove those references before deleting it." });
    } else {
      // Local library deletion conservatively preserves assets until projects/revisions are purged.
      const { localProjects } = await import("./workspace-store");
      if (JSON.stringify(await localProjects(user)).includes(marker)) throw new HTTPException(409, { message: "This image is still used by a saved portfolio." });
      const { readdir } = await import("node:fs/promises");
      const directory = dataPath("revisions", ownerKey(user));
      for (const project of await readdir(directory).catch(() => [])) for (const name of await readdir(path.join(directory, project))) {
        if (name !== "index.json" && (await readFile(path.join(directory, project, name), "utf8")).includes(marker)) throw new HTTPException(409, { message: "A saved revision still uses this image." });
      }
    }
    if (context.state.sections.some((section) => JSON.stringify(section.block).includes(marker))) throw new HTTPException(409, { message: "A reusable section still uses this asset." });
    if (context.state.themes?.some((theme) => JSON.stringify(theme).includes(marker))) throw new HTTPException(409, { message: "A reusable theme still uses this asset." });
    for (const object of [asset.path, ...(asset.variants || []).map((variant) => variant.path)]) {
      if (user.mode === "guest") await unlink(dataPath("assets", object)).catch((error) => { if (error.code !== "ENOENT") throw error; });
      else {
        const result = await removeStoredObject(object);
        if (!result.ok && result.status !== 404) throw new HTTPException(502, { message: "The asset could not be deleted. Please try again." });
      }
    }
    context.state.assets = context.state.assets.filter((item) => item.id !== id);
  });
}

export async function portableAssets(user: Identity, input: Project) {
  const project = structuredClone(input);
  let content = JSON.stringify(project);
  const files: { name: string; buffer: Buffer }[] = [];
  const ids = [...new Set(content.match(/\/api\/assets\/[a-f0-9-]{36}/g) || [])];
  for (const url of ids) {
    const { asset, buffer } = await assetBytes(user, url.slice(12));
    const extension = asset.type === "image/jpeg" ? "jpg" : asset.type.split("/")[1];
    const name = `uploads/${asset.id}.${extension}`;
    files.push({ name, buffer });
    if (asset.type.startsWith("image/")) for (const width of [640, 960]) {
      const variant = await assetBytes(user, asset.id, width);
      files.push({ name: `uploads/${asset.id}-${width}.webp`, buffer: variant.buffer });
    }
    content = content.replaceAll(url, `/assets/${name}`);
  }
  return { project: JSON.parse(content) as Project, files };
}

/** Recover quota and partial objects from uploads interrupted before completion.
 * Keep reservations if storage is unavailable so bytes are never unaccounted for. */
export async function reapPendingAssets(user: Identity, now = Date.now()) {
  return withOwner(user, async ({ state }) => {
    let removed = 0;
    const expired = state.assets.filter((asset) => asset.status === "pending" && new Date(asset.createdAt).getTime() < now - 2 * 60 * 60_000).slice(0, 20);
    for (const asset of expired) {
      if (user.mode === "account" && !storageReady()) break;
      const results = await Promise.all([asset.path, ...(asset.variants || []).map((variant) => variant.path)].map(async (object) => {
        if (user.mode === "guest") return unlink(dataPath("assets", object)).then(() => true).catch((error: NodeJS.ErrnoException) => error.code === "ENOENT");
        return removeStoredObject(object).then((response) => response.ok || response.status === 404).catch(() => false);
      }));
      if (results.every(Boolean)) { state.assets = state.assets.filter((item) => item.id !== asset.id); removed++; }
    }
    return removed;
  });
}
