import { Hono } from "hono";
import { z } from "zod";
import { identity } from "@/backend/services/identity";
import { billingPortal, checkout, reconcileSubscription, stripeWebhook } from "@/backend/billing/stripe";
import { valid } from "./project-routes";

export const billingRoutes = new Hono()
  .post("/checkout", valid(z.object({ plan: z.enum(["creator", "pro"]) })), async (c) => c.json(await checkout(await identity(c, false), c.req.valid("json").plan)))
  .post("/portal", async (c) => c.json(await billingPortal(await identity(c, false))))
  .post("/sync", async (c) => c.json(await reconcileSubscription(await identity(c, false))))
  .post("/webhook", async (c) => c.json(await stripeWebhook(await c.req.text(), c.req.header("stripe-signature") || "")));
