# Portfi service setup and operations

Prepared October 17, 2026. The code is implemented; service credentials, migrations, provider permissions, and live behavior have not yet been verified for this project. Use separate staging resources first.

## 1. Environment and account database

Fill the existing `.env.local` placeholders. If setting up another checkout, copy `.env.example` to `.env.local`. Never replace a populated environment file with the example or put secrets into `NEXT_PUBLIC_*` variables.

Generate **two separate** random secrets with this command, once for `BETTER_AUTH_SECRET` and once for `INTEGRATION_ENCRYPTION_KEY`:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Keep the encryption key in your secret manager and backup/recovery records: existing provider credentials cannot be decrypted with a different key. Key rotation currently requires reconnecting providers unless you implement a migration using both keys. Changing the Better Auth secret also affects existing sessions.

Configure:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | PostgreSQL server connection string with TLS; use a role permitted to manage Portfi/Better Auth tables. The runtime must have access despite RLS. |
| `BETTER_AUTH_SECRET` | First random secret, at least 32 characters |
| `BETTER_AUTH_URL` | Exact application origin: `http://127.0.0.1:3000` locally, your HTTPS origin in staging/production |
| `INTEGRATION_ENCRYPTION_KEY` | Second secret: exactly 32 random bytes encoded as base64 |

Use an appropriate Supabase connection/pooler endpoint for the host. Application transactions use transaction-scoped advisory locks; do not use a connection mode that disallows transactions. Do not disable certificate verification to make a connection succeed.

```sh
npm run check:setup
npm run db:migrate
```

The migration script creates Better Auth tables and applies versioned SQL in `supabase/migrations/`. It also enables RLS and revokes PUBLIC/anon/authenticated grants on auth and application tables. Browser access goes through Hono, with owner authorization; Supabase Auth is not used. Test that unauthenticated Supabase API calls cannot read those tables. Apply schema migrations through one deployment job and back up before upgrades.

`check:setup` checks presence/key shape only, prints no secret values, and does not contact providers. Restart the app and worker after changing environment values.

## 2. Verification and recovery email

Create a Resend project, verify your sender domain, and configure `RESEND_API_KEY` plus `AUTH_EMAIL_FROM` (for example your actual `Portfi <accounts@your-domain>` sender). Test signup, verification, verification resend, recovery, expired links, and logout with two real email accounts. Do not use a pretend sender domain in production.

Optional Google sign-in: create a web OAuth client, configure consent, and set `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`. Register the exact redirect:

```text
<app-origin>/api/auth/callback/google
```

The Google button appears when configured. GitHub publishing authorization is a separate connection, not an account sign-in provider. Better Auth handles the social sign-in protocol; see its [basic usage guide](https://better-auth.com/docs/basic-usage).

A verified account receives Creator once on its first workspace access. The offer is one calendar month, requires no card, and is independent of Stripe trials. Test month-end boundaries and expiry in staging.

## 3. Private Supabase media

Create a **private** storage bucket named `portfi-assets`, or set another name in `SUPABASE_STORAGE_BUCKET`. Configure `SUPABASE_URL` and the server-only `SUPABASE_SERVICE_ROLE_KEY`.

Allow `image/jpeg`, `image/png`, `image/webp`, and `font/woff2`. Choose a bucket upload limit of at least 2 MB so valid generated variants fit. Portfi itself limits original image requests to approximately 1.1 MB and fonts to 400 KB; image requests are decoded, validated, and converted into 640/960 WebP variants. The browser also resizes normal uploads before sending.

No public bucket policy is needed. Portfi streams private images through owner-authorized `/api/assets/:id` routes, while generated sites receive their own public asset files. Keep service credentials on the server. See [Supabase storage access control](https://supabase.com/docs/guides/storage/security/access-control).

Test an interrupted upload, quota exhaustion, deletion of unused files, rejection of files used by projects/revisions/libraries, and export/import into another account. Pending reservations older than two hours are cleaned by the maintenance command; quota is released only when storage cleanup succeeds.

## 4. GitHub App

Create a GitHub App with a user authorization callback:

```text
<app-origin>/api/connections/github/callback
```

Set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `GITHUB_APP_SLUG`. Use App OAuth credentials, not a personal access token. The implementation uses user access tokens with PKCE and supports expiring tokens/refresh. It does not use an App private key or installation-token JWT flow.

Grant the minimum permissions required for the implemented flow: repository Contents read/write, Metadata read, and repository creation permission. GitHub documents repository creation for GitHub App tokens with Administration write or Repository creation write; select the permission available to your App. Review [create a repository for the authenticated user](https://docs.github.com/en/rest/repos/repos#create-a-repository-for-the-authenticated-user) and [GitHub App user authorization](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app).

Install the App for the user's account/repositories and separately authorize its user access. Workspace Settings provides an installation link and a Connect GitHub action. For selected-repository installations, verify the new Portfi repository is included before retrying a failed write; the exact permission/install flow must be proven with your App.

The first release creates private repositories in the connected user's **personal account**. Each repository has a Portfi project marker. Unrelated repositories are protected; changes made outside Portfi stop the next publish for review. Organization/repository selection and merging external code are not implemented.

## 5. Vercel integration

Create a Vercel integration with redirect:

```text
<app-origin>/api/connections/vercel/callback
```

Set `VERCEL_CLIENT_ID`, `VERCEL_CLIENT_SECRET`, and `VERCEL_INTEGRATION_SLUG`. These are integration credentials for the install/code-exchange flow, not Sign in with Vercel credentials. Configure access to read the user profile and create/read projects, upload deployment files, create/read deployments, and cancel deployments. Confirm the current permission names in the integration dashboard and test the least-privilege configuration. See [Vercel integration installation](https://vercel.com/docs/integrations/create-integration/submit-integration).

Settings opens the integration installation flow; the callback stores the encrypted access token and team context. The worker creates a deterministic project for each portfolio and submits the same source files it committed to GitHub. Vercel builds the static Next.js project to `out/`. See [the deployment API](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment).

This implementation does not link Vercel Git auto-deploy. Publish again through Portfi when changing a portfolio. Users can instead download the source and import their own repository manually.

Enable Vercel system environment variables in portfolio projects. Exported SEO uses `VERCEL_PROJECT_PRODUCTION_URL`, falling back to `VERCEL_URL`; set `NEXT_PUBLIC_SITE_URL` in the portfolio project's build environment for a custom domain or another host and rebuild. See [Vercel system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables).

For local OAuth callbacks, use the exact local origin only if the provider accepts it; otherwise use an HTTPS staging URL or approved development tunnel and update all registered callbacks and `BETTER_AUTH_URL` consistently.

## 6. Persistent publishing worker

After migrations and both provider connections are configured, set `PUBLISH_WORKER_ENABLED=true` on the API and worker. Run:

```sh
npm run worker:publish
```

Run it as a supervised persistent Node process on a worker/container host with the same application source, database, storage, and encryption settings. Restart on failure and retain logs. A Vercel serverless request is not a persistent worker. The PostgreSQL queue replaces the earlier proposed Inngest dependency, avoiding an additional orchestration service for this implementation.

The worker uses row claiming, 90-second leases, heartbeat renewal, immutable requested snapshots, and persisted provider checkpoints. Multiple workers can share the queue. `npm run worker:publish -- --once` processes at most one claimed job sequence for operational testing; continuous operation is the default.

Test create/publish, edit/re-publish, duplicate submit, restart after commit, slow builds, rejected permissions, provider timeout, cancellation during polling, and provider disconnect/reconnect.

A timed-out deployment submission is reconciled using its job metadata before another request can be sent. `needs_attention` means check the Vercel dashboard and permissions. Retrying an uncertain job checks for the existing deployment; it does not intentionally create a duplicate. If no provider result can be established, leave it unresolved for operator review. A build that finishes before cancellation is reported as live, not canceled.

Disconnect removes Portfi's stored token and requests cancellation of pending work. If Vercel access is removed before cancellation completes, cancel the cloud build in Vercel or reconnect. Disconnect does not uninstall provider Apps or remove repositories/live sites. Revoke installation access in the provider's settings when appropriate.

## 7. Stripe test billing

Choose prices and create recurring Creator and Pro products/prices in Stripe test mode. Set `STRIPE_SECRET_KEY`, `STRIPE_CREATOR_PRICE_ID`, and `STRIPE_PRO_PRICE_ID`. Enable the Customer Portal with appropriate cancellation and plan-switch options.

Register this webhook and set its signing secret in `STRIPE_WEBHOOK_SECRET`:

```text
<app-origin>/api/billing/webhook
```

Subscribe to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

For local testing, the Stripe CLI can forward signed events:

```sh
stripe listen --forward-to http://127.0.0.1:3000/api/billing/webhook
```

Use the signing secret from that listener for local testing. The raw body is verified before processing; duplicate event IDs are recorded in PostgreSQL, and current subscription state is fetched from Stripe so delayed events cannot restore obsolete access. Settings includes manual billing sync; maintenance reconciles stale accounts. Never grant access just because a browser reaches the checkout success URL.

Test subscription creation, plan changes, cancellation at period end, renewal, failed payment, repeated/reordered webhooks, and the Free fallback after both paid access and the initial offer expire. Publishing/design limits are enforced by Hono; draft content and existing live sites remain intact. Configure business details and live-mode prices separately before enabling real payments.

## 8. Maintenance, monitoring, and recovery

Schedule hourly on a trusted worker/cron host:

```sh
npm run maintenance
```

Each run removes up to 1,000 revisions older than 90 days, old application rate-limit rows, and abandoned uploads in bounded owner batches. It reconciles up to 100 stale Stripe customers when billing is configured. Nonzero exit means a failure needs investigation. Repeated runs drain larger backlogs. Local guest history is pruned on saves; production maintenance operates on account records.

Configure monitoring for API failures, email delivery failures, webhook retries, queue age, failed/needs-attention jobs, stale worker leases, storage cleanup failures, and database capacity. The repository supplies basic logs and job state, not a hosted monitoring dashboard.

Recovery procedure:

1. Enable managed PostgreSQL backups/PITR and a separate backup/versioning process for private storage objects. Database backups do not automatically prove object bytes are recoverable.
2. Preserve the encryption key and provider configuration in a secure secret manager. Never include tokens in support screenshots/logs.
3. Restore database and object backups into isolated staging resources with publishing disabled. Check auth tables, ownership, referenced media, revisions, and a source export before accepting a backup as usable.
4. Reconcile Stripe from its current records. Inspect queued/uncertain jobs and provider resources before starting restored workers; old queue state must not blindly repeat cloud actions.
5. Restore the public app only after the staging exercise succeeds. Reconnect expired/revoked provider credentials. Document actual recovery time and data-loss window.

## 9. Release acceptance

Run tests, type checking, the production build, HTTP verification, and a separate exported-site build. Then complete the real service tests above with two accounts and perform desktop/tablet/phone visual, touch, keyboard, screen-reader, and reduced-motion review.

Measure landing/editor/exported-site performance on representative devices. Complete business-specific terms/privacy/support content and data-deletion procedures, then run a small beta. Placeholder configuration and passing local tests are not evidence of production readiness.
