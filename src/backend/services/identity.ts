import { createHash, randomBytes } from "node:crypto";
import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { getAuth } from "@/backend/auth";

export type Identity = { id: string; mode: "guest" | "account"; name: string; email: string; verified: boolean };
export const guestEnabled = () => process.env.NODE_ENV !== "production" && process.env.PORTFI_DISABLE_GUEST !== "true";

const identities = new WeakMap<Request, Promise<Identity>>();
export async function identity(c: Context, allowGuest = true): Promise<Identity> {
  let result = identities.get(c.req.raw);
  if (!result) { result = resolveIdentity(c, allowGuest); identities.set(c.req.raw, result); }
  const user = await result;
  if (!allowGuest && user.mode === "guest") throw new HTTPException(401, { message: "Sign in to use this feature." });
  return user;
}
async function resolveIdentity(c: Context, allowGuest: boolean): Promise<Identity> {
  const auth = getAuth();
  if (auth) {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (session) {
      if (!session.user.emailVerified) throw new HTTPException(403, { message: "Verify your email before opening your workspace." });
      return { id: session.user.id, mode: "account", name: session.user.name, email: session.user.email, verified: true };
    }
  }
  if (!allowGuest || !guestEnabled()) throw new HTTPException(401, { message: "Sign in to open your workspace." });
  let token = getCookie(c, "portfi_workspace");
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    token = randomBytes(32).toString("hex");
    setCookie(c, "portfi_workspace", token, { httpOnly: true, sameSite: "Lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  }
  return { id: createHash("sha256").update(token).digest("hex"), mode: "guest", name: "Your local workspace", email: "", verified: false };
}
