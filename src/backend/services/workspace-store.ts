import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PoolClient } from "pg";
import { database } from "@/backend/auth";
import type { Block, Project } from "@/shared/portfolio/schema";
import { trialEnd } from "@/backend/billing/trial";
import type { Identity } from "./identity";

export type PlanId = "free" | "creator" | "pro";
export type Asset = { id: string; name: string; size: number; type: string; path: string; createdAt: string; status: "pending" | "ready"; variants?: { width: number; path: string; size: number }[] };
export type Connection = { encrypted: string; account: string; providerId: string; teamId?: string; expiresAt?: number; connectedAt: string };
export type WorkspaceState = {
  version: 1;
  createdAt: string;
  trial: { startedAt: string; endsAt: string } | null;
  subscription: { plan: PlanId; status: string; customerId: string; subscriptionId: string; checkedAt: string; accessUntil: string } | null;
  customerId?: string;
  metadata: Record<string, { archivedAt: string | null; trashedAt: string | null; updatedAt: string }>;
  assets: Asset[];
  sections: { id: string; name: string; block: Block }[];
  themes?: { id: string; name: string; theme: Project["theme"] }[];
  connections: Partial<Record<"github" | "vercel", Connection>>;
};
export type OwnerContext = { user: Identity; db: PoolClient | null; state: WorkspaceState };
const queues = new Map<string, Promise<unknown>>();

export function dataPath(...parts: string[]) {
  // Development-only runtime data must never be traced into a deployment bundle.
  return path.join(/* turbopackIgnore: true */ process.env.PORTFI_DATA_DIR || path.join(process.cwd(), ".portfi"), ...parts);
}
export const ownerKey = (user: Identity) => createHash("sha256").update(`${user.mode}:${user.id}`).digest("hex");

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await readFile(file, "utf8")) as T; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback; throw error; }
}
export async function atomicJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomBytes(8).toString("hex")}.tmp`;
  await writeFile(temporary, JSON.stringify(value), { encoding: "utf8", mode: 0o600 });
  await rename(temporary, file);
}

async function exclusive<T>(key: string, callback: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) || Promise.resolve();
  const next = previous.catch(() => {}).then(callback);
  queues.set(key, next);
  try { return await next; } finally { if (queues.get(key) === next) queues.delete(key); }
}

function initialState(user: Identity): WorkspaceState {
  const now = new Date();
  return { version: 1, createdAt: now.toISOString(), trial: user.mode === "account" && user.verified ? { startedAt: now.toISOString(), endsAt: trialEnd(now).toISOString() } : null, subscription: null, metadata: {}, assets: [], sections: [], connections: {} };
}

/** Serializes quota reservations, documents, revisions, and account metadata per owner.
 * PostgreSQL advisory locks also cover separate API/worker instances. Local mode is development-only. */
export async function withOwner<T>(user: Identity, callback: (context: OwnerContext) => Promise<T>): Promise<T> {
  return exclusive(`${user.mode}:${user.id}`, async () => {
    const db = user.mode === "account" ? await database()!.connect() : null;
    try {
      let state: WorkspaceState;
      let original: string | null;
      if (db) {
        await db.query("BEGIN");
        await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [user.id]);
        const result = await db.query("SELECT state FROM portfi_workspaces WHERE owner_id = $1 FOR UPDATE", [user.id]);
        state = result.rows[0]?.state || initialState(user);
        original = result.rows[0] ? JSON.stringify(state) : null;
      } else {
        state = await readJson(dataPath("workspaces", `${ownerKey(user)}.meta.json`), initialState(user));
        original = null;
      }
      if (user.mode === "account" && user.verified && !state.trial) {
        const started = new Date();
        state.trial = { startedAt: started.toISOString(), endsAt: trialEnd(started).toISOString() };
      }
      const value = await callback({ user, db, state });
      if (db) {
        if (original !== JSON.stringify(state)) await db.query("INSERT INTO portfi_workspaces(owner_id, state) VALUES($1, $2) ON CONFLICT(owner_id) DO UPDATE SET state = EXCLUDED.state, updated_at = now()", [user.id, JSON.stringify(state)]);
        await db.query("COMMIT");
      } else await atomicJson(dataPath("workspaces", `${ownerKey(user)}.meta.json`), state);
      return value;
    } catch (error) { if (db) await db.query("ROLLBACK"); throw error; }
    finally { db?.release(); }
  });
}

export function localProjectsFile(user: Identity) { return dataPath("workspaces", `${user.id}.json`); }
export async function localProjects(user: Identity): Promise<Project[]> { return readJson(localProjectsFile(user), []); }
