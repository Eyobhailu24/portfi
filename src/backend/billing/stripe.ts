import Stripe from "stripe";
import { HTTPException } from "hono/http-exception";
import { database } from "@/backend/auth";
import { withOwner } from "@/backend/services/workspace-store";
import type { Identity } from "@/backend/services/identity";

let instance: Stripe | undefined;
export const billingReady = () => Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_CREATOR_PRICE_ID && process.env.STRIPE_PRO_PRICE_ID);
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new HTTPException(503, { message: "Billing needs Stripe settings in .env.local." });
  return instance ??= new Stripe(process.env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, timeout: 15_000 });
}
export function appOrigin() {
  const url = new URL(process.env.BETTER_AUTH_URL || "http://127.0.0.1:3000");
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("The production app URL must use HTTPS.");
  return url.origin;
}
const priceId = (plan: "creator" | "pro") => process.env[plan === "creator" ? "STRIPE_CREATOR_PRICE_ID" : "STRIPE_PRO_PRICE_ID"];

export async function checkout(user: Identity, plan: "creator" | "pro") {
  if (!billingReady()) throw new HTTPException(503, { message: "Paid plans become available after Stripe products, prices, and webhooks are configured." });
  return withOwner(user, async ({ state }) => {
    if (state.subscription && ["active", "trialing", "past_due", "unpaid"].includes(state.subscription.status)) throw new HTTPException(409, { message: "Manage your existing subscription in the billing portal." });
    const client = stripe();
    if (!state.customerId) {
      const customer = await client.customers.create({ email: user.email, name: user.name, metadata: { portfiOwner: user.id } }, { idempotencyKey: `portfi-customer-${user.id}` });
      state.customerId = customer.id;
    }
    const session = await client.checkout.sessions.create({ mode: "subscription", customer: state.customerId, client_reference_id: user.id,
      line_items: [{ price: priceId(plan)!, quantity: 1 }], allow_promotion_codes: true,
      success_url: `${appOrigin()}/settings?billing=success`, cancel_url: `${appOrigin()}/settings?billing=canceled`,
      metadata: { portfiOwner: user.id, plan }, subscription_data: { metadata: { portfiOwner: user.id } },
    }, { idempotencyKey: `portfi-checkout-${user.id}-${plan}-${Math.floor(Date.now() / 600_000)}` });
    if (!session.url) throw new HTTPException(502, { message: "Checkout could not be opened." });
    return { url: session.url };
  });
}

export async function billingPortal(user: Identity) {
  return withOwner(user, async ({ state }) => {
    if (!state.customerId) throw new HTTPException(400, { message: "There is no billing account yet. Choose a paid plan first." });
    const session = await stripe().billingPortal.sessions.create({ customer: state.customerId, return_url: `${appOrigin()}/settings` });
    return { url: session.url };
  });
}

export async function reconcileSubscription(user: Identity, eventId?: string) {
  return withOwner(user, async (context) => {
    if (eventId && context.db) {
      const processed = await context.db.query("SELECT id FROM portfi_webhook_events WHERE provider='stripe' AND id=$1", [eventId]);
      if (processed.rowCount) return { processed: true };
    }
    if (context.state.customerId) {
      // Fetch authoritative current state; delayed or reordered webhooks cannot grant
      // entitlements from an obsolete subscription payload.
      const subscriptions = await stripe().subscriptions.list({ customer: context.state.customerId, status: "all", limit: 100 });
      const known = subscriptions.data.filter((subscription) => subscription.items.data.some((item) => item.price.id === priceId("creator") || item.price.id === priceId("pro")));
      const subscription = known.find((subscription) => ["active", "trialing"].includes(subscription.status)) || known.sort((a, b) => b.created - a.created)[0];
      const item = subscription?.items.data.find((item) => item.price.id === priceId("creator") || item.price.id === priceId("pro"));
      context.state.subscription = subscription && item ? { plan: item.price.id === priceId("pro") ? "pro" : "creator", status: subscription.status, customerId: context.state.customerId, subscriptionId: subscription.id, checkedAt: new Date().toISOString(), accessUntil: new Date(item.current_period_end * 1000).toISOString() } : null;
    }
    if (eventId && context.db) await context.db.query("INSERT INTO portfi_webhook_events(provider,id) VALUES('stripe',$1) ON CONFLICT DO NOTHING", [eventId]);
    return { processed: true };
  });
}

export async function stripeWebhook(raw: string, signature: string) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) throw new HTTPException(503, { message: "Stripe webhooks are not configured." });
  let event: Stripe.Event;
  try { event = stripe().webhooks.constructEvent(raw, signature, process.env.STRIPE_WEBHOOK_SECRET); }
  catch { throw new HTTPException(400, { message: "Invalid Stripe webhook signature." }); }
  const types = ["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "invoice.paid", "invoice.payment_failed"];
  if (!types.includes(event.type)) return { received: true };
  const object = event.data.object as unknown as { customer?: string | { id: string } | null };
  const customer = typeof object.customer === "string" ? object.customer : object.customer?.id;
  if (!customer) return { received: true };
  if (!database()) throw new HTTPException(503, { message: "The account database is unavailable. Retry this webhook." });
  const owners = await database()!.query("SELECT owner_id FROM portfi_workspaces WHERE state->>'customerId'=$1", [customer]);
  if (!owners.rows[0]) throw new HTTPException(503, { message: "The billing account is not ready yet. Retry this webhook." });
  await reconcileSubscription({ id: owners.rows[0].owner_id, mode: "account", name: "", email: "", verified: true }, event.id);
  return { received: true };
}
