import { createHash } from "node:crypto";
import { HTTPException } from "hono/http-exception";
import { database } from "@/backend/auth";
import type { Identity } from "@/backend/services/identity";

const local = new Map<string, { window: number; count: number }>();
export async function enforceWriteRate(user: Identity) {
  const window = Math.floor(Date.now() / 60_000);
  const key = createHash("sha256").update(`${user.mode}:${user.id}`).digest("hex");
  let count: number;
  if (user.mode === "account") {
    const result = await database()!.query("INSERT INTO portfi_rate_limits(key,window_key,hits) VALUES($1,$2,1) ON CONFLICT(key) DO UPDATE SET window_key=$2,hits=CASE WHEN portfi_rate_limits.window_key=$2 THEN portfi_rate_limits.hits+1 ELSE 1 END RETURNING hits", [key, window]);
    count = result.rows[0].hits;
  } else {
    if (local.size > 10_000) for (const [key, value] of local) if (value.window !== window) local.delete(key);
    const current = local.get(key);
    const value = { window, count: current?.window === window ? current.count + 1 : 1 };
    local.set(key, value); count = value.count;
  }
  if (count > 120) throw new HTTPException(429, { message: "This workspace is making changes too quickly. Wait a minute, then try again." });
}
