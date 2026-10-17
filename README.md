# Portfi

A no-code, multi-page portfolio builder using Next.js, React, TypeScript, Hono, TanStack Query, and Puck. Landing, backend, and workspace code live in separate domains.

## Run locally

Requires Node.js 22.13 or later:

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000. Use `npm.cmd` on Windows if PowerShell blocks `npm.ps1`.

`.env.local` contains blank service placeholders for configuration. Keep credentials there; `.env.example` is the shareable template. Local editing and export work without external services. Account, payment, and connected-publishing controls report missing setup rather than simulating success.

## Implemented

- Animated landing page, live demonstration, four starting templates, template filters, FAQs, reduced motion, and a persistent pause control.
- Dashboard with rename, duplicate, archive, trash, restore, permanent deletion, and JSON/source-ZIP import.
- Multi-page editor with page ordering, home-page selection, stable internal links, renamed-page redirects, page titles, descriptions, social images, and favicon.
- Thirteen section types: introduction, projects, text, experience, image, contact, education, skills, testimonials, gallery, links, project detail, and guided columns. Columns contain two or three text, image, or link blocks.
- Drag/reorder, keyboard ordering and resizing, width/spacing controls, rich text shortcuts, image crop/focal point, custom WOFF2 fonts, reusable sections/themes, and contrast feedback.
- Desktop/tablet/mobile overrides with inheritance/reset; device previews; entrances, timing, delay, easing, stagger, hover effects, and replay.
- Serialized autosave, stale-write protection, local draft recovery, immutable version history, named versions, and restoration as a new revision.
- Private media library with validated images, server-generated WebP variants, reference-aware deletion, quota reservations, and abandoned-upload cleanup.
- Hono-mounted Better Auth with verification/resend, password recovery, Google sign-in when configured, and server-owned authorization.
- Server-enforced Free/Creator/Pro limits, a one-time calendar-month Creator offer for verified accounts, downgrade preservation, and Free-compatible copies.
- GitHub App and Vercel integration connections, encrypted credentials, durable publishing jobs, status, cancellation, retry, and recovery after uncertain provider requests.
- Stripe Checkout, Customer Portal, signed/deduplicated webhooks, subscription reconciliation, and configurable recurring price IDs.
- Portable Next.js ZIPs with concrete static pages, images/font variants, animations, licenses, pinned dependencies, redirects, canonical URLs, sitemap, and robots metadata.

Service integrations are implemented but **have not been exercised against your accounts**. Follow [SERVICE_SETUP.md](SERVICE_SETUP.md) before enabling them.

## Plans

| Plan | Active portfolios | Pages per portfolio | Document/media storage | Available history |
| --- | ---: | ---: | ---: | --- |
| Free | 1 | 3 | 100 MB | No history browser |
| Creator | 3 | 10 | 1 GB | 30 days, at most 200 snapshots/project |
| Pro | 10 | 30 | 5 GB | 90 days, at most 200 snapshots/project |

Creator adds all templates, device overrides, custom fonts, standard animation tuning, and optional footer credit. Pro adds reusable sections/themes and hover motion. Paid prices remain configurable in Stripe.

The Creator offer starts once when a verified account first accesses its workspace; no card is required. Expiry preserves projects and deployed sites. Oversized/premium drafts remain editable, but publishing/export requires a compatible plan or design. The dashboard can create a Free-compatible copy and archive the original. Extra active portfolios must be archived to fit the current plan.

Development guests have Pro preview controls, ten active portfolios, and thirty retained snapshots per project. Guest workspaces are always disabled in production.

## Data and backups

Local guests use a private workspace cookie and files under `.portfi/`. Account documents, history, quotas, connections, and jobs use PostgreSQL; account uploads use a private Supabase bucket through Hono. No service-role credentials reach the browser.

Use **Download source ZIP** for a portable backup including uploaded files. Dashboard **Import backup** restores that ZIP into a new project with fresh IDs and owned uploads. JSON backups preserve content/settings but refer to existing managed assets; they are best restored into the same workspace. An import interrupted after uploading files can leave unused library items, which can be deleted.

History snapshots are captured at most once per minute for ordinary saves, plus named versions and lifecycle actions. Retained revisions protect their images/fonts from deletion. Permanent portfolio deletion removes its history and job records, but leaves shared media and external GitHub/Vercel resources intact.

## Services and workers

```sh
npm run check:setup
npm run db:migrate
npm run worker:publish
npm run maintenance
```

Configure services before migrations or workers. `check:setup` reports setting names only and does not validate credentials. The publish worker is a separate persistent process; it is not a Vercel request handler. Schedule maintenance hourly to reclaim interrupted uploads, expire old revision/rate-limit records, and reconcile stale billing accounts. See [SERVICE_SETUP.md](SERVICE_SETUP.md) for callback URLs, permissions, deployment, and recovery.

Publishing commits to a dedicated repository in the connected GitHub user's personal account and deploys those exact files to a project in their Vercel account/team. It does not configure Vercel Git auto-deploy; republishing happens through Portfi. External repository changes stop publishing for review. Existing live sites remain independent of Portfi and subscription changes.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

With the local server running:

```sh
npm run verify:api
cd .portfi/verified-export
npm ci
npm run build
```

The HTTP script creates its own isolated workspace and checks save/reload, conflicts, ownership, invalid links, cross-origin rejection, and source export. It never edits the portfolio in your browser's workspace. The exported `out/` site does not require the Portfi backend or editor.

Current results and remaining release checks are recorded in [FUNCTIONALITY_STATUS.md](FUNCTIONALITY_STATUS.md). Visual/device review and measured performance remain pending; passing tests/builds does not establish animation smoothness or Core Web Vitals.

## Source map

- `src/app/`: thin Next.js routes and layouts.
- `src/landing/`: marketing sections, demonstrations, motion, and landing styles.
- `src/backend/`: Hono API, auth, services, storage, billing, and publishing worker logic.
- `src/workspace/`: dashboard, editor, account screens, typed API client, TanStack Query, and workspace styles.
- `src/shared/`: UI primitives, public contracts/plans, portable portfolio schema/renderer, design tokens.
- `supabase/migrations/`: versioned application schema; Better Auth migrations run through the same script.
- `scripts/`: migration, setup, worker, maintenance, and HTTP verification commands.

Architecture tests enforce domain boundaries. Eyoben UI source and asset attribution remain in [EYOBEN_LICENSE.txt](EYOBEN_LICENSE.txt) and [ASSET_CREDITS.md](ASSET_CREDITS.md).

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for product direction and [UI_DESIGN_GUIDE.md](UI_DESIGN_GUIDE.md) for design review criteria.
