import { createHash, randomBytes } from "node:crypto";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { appOrigin } from "@/backend/billing/stripe";
import { decryptSecret, encryptSecret, safeEqual } from "@/backend/security/secrets";
import type { Identity } from "@/backend/services/identity";
import { withOwner } from "@/backend/services/workspace-store";

export type Provider = "github" | "vercel";
type Tokens = { access: string; refresh?: string; refreshExpiresAt?: number };
export function providerReady(provider: Provider) {
  const encryption = Buffer.from(process.env.INTEGRATION_ENCRYPTION_KEY || "", "base64").length === 32;
  return encryption && Boolean(provider === "github" ? process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET && process.env.GITHUB_APP_SLUG : process.env.VERCEL_CLIENT_ID && process.env.VERCEL_CLIENT_SECRET && process.env.VERCEL_INTEGRATION_SLUG);
}
async function tokenResponse(response: Response) {
  if (!response.ok) throw new HTTPException(502, { message: "The provider connection could not be completed. Please reconnect." });
  const result = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; refresh_token_expires_in?: number; error?: string; user_id?: string; team_id?: string; installation_id?: string };
  if (result.error || !result.access_token) throw new HTTPException(400, { message: "The provider authorization was declined or expired. Try connecting again." });
  return result;
}

export async function beginConnection(c: Context, user: Identity, provider: Provider) {
  if (!providerReady(provider)) throw new HTTPException(503, { message: `Add the ${provider === "github" ? "GitHub App" : "Vercel integration"} settings to .env.local before connecting.` });
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  setCookie(c, `portfi_connect_${provider}`, encryptSecret({ state, verifier, expires: Date.now() + 600_000 }, user.id), { httpOnly: true, sameSite: "Lax", secure: process.env.NODE_ENV === "production", path: `/api/connections/${provider}`, maxAge: 600 });
  const callback = `${appOrigin()}/api/connections/${provider}/callback`;
  const url = provider === "github" ? new URL("https://github.com/login/oauth/authorize") : new URL(`https://vercel.com/integrations/${encodeURIComponent(process.env.VERCEL_INTEGRATION_SLUG!)}/new`);
  url.searchParams.set("state", state);
  if (provider === "github") {
    url.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID!);
    url.searchParams.set("redirect_uri", callback);
    url.searchParams.set("code_challenge", createHash("sha256").update(verifier).digest("base64url"));
    url.searchParams.set("code_challenge_method", "S256");
  }
  return { url: url.toString() };
}

export async function completeConnection(c: Context, user: Identity, provider: Provider) {
  const encrypted = getCookie(c, `portfi_connect_${provider}`);
  deleteCookie(c, `portfi_connect_${provider}`, { path: `/api/connections/${provider}`, secure: process.env.NODE_ENV === "production" });
  if (!encrypted) throw new HTTPException(400, { message: "The connection request expired. Start again from workspace settings." });
  let saved: { state: string; verifier: string; expires: number };
  try { saved = decryptSecret(encrypted, user.id); } catch { throw new HTTPException(400, { message: "This connection request is invalid." }); }
  if (saved.expires < Date.now() || !safeEqual(saved.state, c.req.query("state") || "") || !c.req.query("code")) throw new HTTPException(400, { message: "The connection request expired or was declined. Start again from settings." });
  const callback = `${appOrigin()}/api/connections/${provider}/callback`;
  const response = await fetch(provider === "github" ? "https://github.com/login/oauth/access_token" : "https://api.vercel.com/v2/oauth/access_token", {
    method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env[provider === "github" ? "GITHUB_CLIENT_ID" : "VERCEL_CLIENT_ID"]!, client_secret: process.env[provider === "github" ? "GITHUB_CLIENT_SECRET" : "VERCEL_CLIENT_SECRET"]!, code: c.req.query("code")!, redirect_uri: callback, ...(provider === "github" ? { code_verifier: saved.verifier } : { grant_type: "authorization_code" }) }), signal: AbortSignal.timeout(20_000),
  });
  const token = await tokenResponse(response);
  const profileResponse = await fetch(provider === "github" ? "https://api.github.com/user" : "https://api.vercel.com/v2/user", { headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/json", "User-Agent": "Portfi" }, signal: AbortSignal.timeout(15_000) });
  if (!profileResponse.ok) throw new HTTPException(502, { message: "The provider profile could not be verified. Reconnect to try again." });
  const profile = await profileResponse.json() as { id?: number; login?: string; user?: { id: string; username?: string; email?: string } };
  const account = provider === "github" ? profile.login : profile.user?.username || profile.user?.email || token.team_id;
  const providerId = provider === "github" ? String(profile.id || "") : profile.user?.id || token.user_id;
  if (!account || !providerId) throw new HTTPException(502, { message: "The provider did not return a usable account." });
  await withOwner(user, async ({ state }) => {
    state.connections[provider] = { encrypted: encryptSecret({ access: token.access_token!, refresh: token.refresh_token, refreshExpiresAt: token.refresh_token_expires_in ? Date.now() + token.refresh_token_expires_in * 1000 : undefined } satisfies Tokens, user.id), account, providerId, teamId: token.team_id, expiresAt: token.expires_in ? Date.now() + token.expires_in * 1000 : undefined, connectedAt: new Date().toISOString() };
  });
}

export async function connectionToken(user: Identity, provider: Provider) {
  return withOwner(user, async ({ state }) => {
    const connection = state.connections[provider];
    if (!connection) throw new HTTPException(409, { message: `Connect ${provider === "github" ? "GitHub" : "Vercel"} in workspace settings first.` });
    const tokens = decryptSecret<Tokens>(connection.encrypted, user.id);
    if (connection.expiresAt && connection.expiresAt < Date.now() + 60_000) {
      if (provider !== "github" || !tokens.refresh || (tokens.refreshExpiresAt && tokens.refreshExpiresAt < Date.now())) throw new HTTPException(409, { message: `Your ${provider} connection expired. Reconnect in settings.` });
      const refreshed = await tokenResponse(await fetch("https://github.com/login/oauth/access_token", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.GITHUB_CLIENT_ID!, client_secret: process.env.GITHUB_CLIENT_SECRET!, grant_type: "refresh_token", refresh_token: tokens.refresh }), signal: AbortSignal.timeout(20_000) }));
      tokens.access = refreshed.access_token!; tokens.refresh = refreshed.refresh_token;
      tokens.refreshExpiresAt = refreshed.refresh_token_expires_in ? Date.now() + refreshed.refresh_token_expires_in * 1000 : undefined;
      connection.expiresAt = Date.now() + (refreshed.expires_in || 28_800) * 1000;
      connection.encrypted = encryptSecret(tokens, user.id);
    }
    return { ...tokens, teamId: connection.teamId, account: connection.account };
  });
}

export async function connectionList(user: Identity) {
  return withOwner(user, async ({ state }) => ({ github: state.connections.github ? { account: state.connections.github.account, connectedAt: state.connections.github.connectedAt } : null, vercel: state.connections.vercel ? { account: state.connections.vercel.account, connectedAt: state.connections.vercel.connectedAt, teamId: state.connections.vercel.teamId } : null, configured: { github: providerReady("github"), vercel: providerReady("vercel") }, installUrl: process.env.GITHUB_APP_SLUG ? `https://github.com/apps/${encodeURIComponent(process.env.GITHUB_APP_SLUG)}/installations/new` : null }));
}

export async function disconnect(user: Identity, provider: Provider) {
  await withOwner(user, async ({ state, db }) => {
    delete state.connections[provider];
    if (db) await db.query("UPDATE portfi_publish_jobs SET state=jsonb_set(state,'{cancelRequested}','true'), status=CASE WHEN status='running' THEN 'running' WHEN state->>'deploymentSubmitted'='true' OR state->>'deployment' IS NOT NULL THEN 'queued' ELSE 'canceled' END, available_at=now(),updated_at=now() WHERE owner_id=$1 AND status IN ('queued','retrying','running')", [user.id]);
  });
}
