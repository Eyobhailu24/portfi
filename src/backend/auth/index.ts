import { betterAuth, type BetterAuthOptions } from "better-auth";
import { Pool } from "pg";

let instance: ReturnType<typeof betterAuth> | undefined;
let pool: Pool | undefined;

export function database() {
  if (!process.env.DATABASE_URL) return null;
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  return pool;
}

async function sendEmail(to: string, subject: string, url: string) {
  if (!process.env.RESEND_API_KEY || !process.env.AUTH_EMAIL_FROM) throw new Error("Email delivery has not been configured.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.AUTH_EMAIL_FROM, to, subject, text: `${subject}\n\n${url}\n\nIf you did not request this, you can ignore this email.\n— Portfi` }), signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Email delivery failed. Please try again.");
}

export function getAuth() {
  const db = database();
  if (!db || !process.env.BETTER_AUTH_SECRET) return null;
  const options: BetterAuthOptions = {
    appName: "Portfi", database: db, secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL || "http://127.0.0.1:3000",
    trustedOrigins: [process.env.BETTER_AUTH_URL || "http://127.0.0.1:3000"],
    emailAndPassword: { enabled: true, requireEmailVerification: true, sendResetPassword: async ({ user, url }) => sendEmail(user.email, "Reset your Portfi password", url) },
    emailVerification: { sendOnSignUp: true, sendVerificationEmail: async ({ user, url }) => sendEmail(user.email, "Verify your Portfi email", url) },
    socialProviders: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } } : {},
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    rateLimit: { enabled: true, window: 60, max: 30, storage: "database" },
  };
  instance ??= betterAuth(options);
  return instance;
}
