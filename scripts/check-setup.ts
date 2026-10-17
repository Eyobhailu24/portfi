import { existsSync } from "node:fs";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const groups: Record<string, string[]> = {
  "Accounts / database": ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL"],
  "Verification / recovery email": ["RESEND_API_KEY", "AUTH_EMAIL_FROM"],
  "Private image storage": ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_STORAGE_BUCKET"],
  "GitHub App": ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "GITHUB_APP_SLUG", "INTEGRATION_ENCRYPTION_KEY"],
  "Vercel integration": ["VERCEL_CLIENT_ID", "VERCEL_CLIENT_SECRET", "VERCEL_INTEGRATION_SLUG", "INTEGRATION_ENCRYPTION_KEY"],
  "Stripe billing": ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_CREATOR_PRICE_ID", "STRIPE_PRO_PRICE_ID"],
};
let missing = false;
for (const [name, keys] of Object.entries(groups)) {
  const absent = keys.filter((key) => !process.env[key]);
  console.log(`${absent.length ? "NEEDS SETUP" : "CONFIGURED"} · ${name}${absent.length ? `: ${absent.join(", ")}` : ""}`);
  if (absent.length) missing = true;
}
if (process.env.INTEGRATION_ENCRYPTION_KEY && Buffer.from(process.env.INTEGRATION_ENCRYPTION_KEY, "base64").length !== 32) console.log("INVALID · INTEGRATION_ENCRYPTION_KEY must encode 32 bytes.");
if (process.env.BETTER_AUTH_SECRET && process.env.BETTER_AUTH_SECRET.length < 32) console.log("INVALID · BETTER_AUTH_SECRET must contain at least 32 characters.");
console.log(`Publish worker: ${process.env.PUBLISH_WORKER_ENABLED === "true" ? "enabled; run npm run worker:publish on a persistent worker host" : "disabled"}`);
console.log(missing ? "Local development still works. Fill .env.local, apply migrations, and verify provider flows before production." : "Settings are present. This check does not contact providers or prove credentials are valid.");
