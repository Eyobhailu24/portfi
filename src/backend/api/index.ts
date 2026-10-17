import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";
import { getAuth } from "@/backend/auth";
import { guestEnabled, identity } from "@/backend/services/identity";
import { storageReady } from "@/backend/services/assets";
import { projectRoutes } from "./project-routes";
import { workspaceRoutes } from "./workspace-routes";
import { billingRoutes } from "./billing-routes";
import { publishingRoutes } from "./publishing-routes";
import { billingReady } from "@/backend/billing/stripe";
import { publishingReady } from "@/backend/publishing/jobs";
import { enforceWriteRate } from "@/backend/security/rate-limit";

export const app = new Hono().basePath("/api")
  .use("*", secureHeaders())
  .use("*", bodyLimit({ maxSize: 10 * 1024 * 1024, onError: (c) => c.json({ error: "This portfolio is too large. Use smaller images." }, 413) }))
  .use("*", async (c, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
      const origin = c.req.header("origin");
      if (!c.req.path.endsWith("/billing/webhook") && origin && origin !== new URL(c.req.url).origin && origin !== process.env.BETTER_AUTH_URL) return c.json({ error: "Request origin is not allowed." }, 403);
      if (!c.req.path.includes("/auth/") && !c.req.path.endsWith("/billing/webhook")) await enforceWriteRate(await identity(c));
    }
    c.header("Cache-Control", "private, no-store");
    await next();
  })
  .get("/health", (c) => c.json({ name: "Portfi", status: "ok" }))
  .get("/capabilities", (c) => c.json({
    auth: Boolean(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET),
    email: Boolean(process.env.RESEND_API_KEY && process.env.AUTH_EMAIL_FROM),
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    guest: guestEnabled(), storage: storageReady(), publishing: publishingReady(), billing: billingReady(),
  }))
  .all("/auth/*", (c) => {
    const auth = getAuth();
    if (!auth) return c.json({ error: "Account sign-in needs database and email setup. You can try the local workspace while developing." }, 503);
    return auth.handler(c.req.raw);
  })
  .get("/session", async (c) => {
    try { const user = await identity(c); return c.json({ user: { name: user.name, email: user.email, mode: user.mode, verified: user.verified } }); }
    catch (error) { if (error instanceof HTTPException && error.status === 401) return c.json({ user: null }); throw error; }
  })
  .route("/projects", projectRoutes)
  .route("/", workspaceRoutes)
  .route("/billing", billingRoutes)
  .route("/", publishingRoutes);

app.onError((error, c) => {
  if (error instanceof HTTPException) return c.json({ error: error.message }, error.status);
  if (error instanceof ZodError) return c.json({ error: error.issues[0]?.message || "Some settings are invalid." }, 400);
  console.error("Portfi API:", error.message);
  return c.json({ error: "Something went wrong saving your workspace. Your local draft is still available." }, 500);
});

export type AppType = typeof app;
