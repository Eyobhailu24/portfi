import Stripe from "stripe";
import { afterEach, expect, it, vi } from "vitest";
import { stripeWebhook } from "./stripe";
afterEach(() => vi.unstubAllEnvs());

it("verifies raw webhook signatures and rejects forged or stale signatures", async () => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture"); vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_fixture"); vi.stubEnv("DATABASE_URL", "");
  const sdk = new Stripe("sk_test_fixture");
  const payload = JSON.stringify({ id: "evt_fixture", type: "test.unhandled", data: { object: {} } });
  const signature = sdk.webhooks.generateTestHeaderString({ payload, secret: "whsec_fixture" });
  await expect(stripeWebhook(payload, signature)).resolves.toEqual({ received: true });
  await expect(stripeWebhook(payload + " ", signature)).rejects.toThrow(/signature/);
  const stale = sdk.webhooks.generateTestHeaderString({ payload, secret: "whsec_fixture", timestamp: Math.floor(Date.now() / 1000) - 1000 });
  await expect(stripeWebhook(payload, stale)).rejects.toThrow(/signature/);
});
