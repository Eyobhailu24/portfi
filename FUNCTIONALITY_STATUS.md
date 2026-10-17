# Portfi functionality status

Updated October 17, 2026. The previously missing core features now have implementations, local tests, and configuration placeholders. Real service operation remains unverified until the owner's services are configured.

## Implemented locally

| Area | Current implementation |
| --- | --- |
| Architecture and landing | Separate landing/backend/workspace/shared domains with import-boundary tests. Animated landing sections, template filtering, FAQs, demonstrations, reduced motion, pause preference, translucent edges and rounded clipping. |
| Portfolio lifecycle | Rename, duplicate, archive/unarchive, trash/restore, confirmed permanent deletion, JSON and full source-ZIP import. Minimal dashboard summaries. |
| Pages | Reordering, duplication with fresh IDs, home-page selection, stable page-ID links including nested columns, slug redirects, page SEO, social images, favicon. |
| Sections | Thirteen section types and guided two/three-column composition. Reusable section and theme libraries. |
| Design | Responsive overrides with reset/inheritance, crop/fit/aspect/focal point, custom font uploads, constrained rich text, contrast feedback, resize handles and keyboard alternatives. |
| Motion | Entrance presets, duration/delay/easing, view/load triggers, stagger, hover presets, preview replay, and reduced-motion behavior in shared code. |
| Saves/history | Serialized autosave, expected-revision conflicts, local recovery/backup, persistent snapshots, named versions, restore-as-new-revision, and retention. |
| Media | Local/private Supabase storage adapters, format/size validation, Sharp-generated 640/960 WebP variants, ownership, transactional quota reservations, reference-aware deletion, stale-upload reaper. |
| Export | Independent static Next.js project, shared renderer/CSS/motion, bundled original/variant uploads and fonts, licenses, lockfile, canonical/social metadata, robots/sitemap, Vercel redirects and static fallback routes. |
| Plans | Free/Creator/Pro entitlements, verified-account calendar-month Creator offer, active/page/storage quotas, retained drafts after downgrade, Free-compatible copy workflow. |

## Implemented integrations awaiting service setup

| Service | Code present | Still needs real verification |
| --- | --- | --- |
| PostgreSQL + Better Auth | Hono auth routes, email verification/resend, login/logout, recovery, Google entry button, sessions, owner locks, migrations, private database grants | Run migrations in staging; complete signup/recovery/session lifecycle with two accounts and prove isolation. |
| Resend | Verification and recovery delivery adapter with bounded timeout | Verify sender domain, deliver real messages, test invalid/expired links and resend limits. |
| Supabase Storage | Private server-owned uploads, variants, reads/deletion, quota accounting | Create private bucket; verify API role isolation, upload failure cleanup, export, and backup restoration. |
| GitHub App | Owner-bound OAuth state + PKCE, encrypted access/refresh tokens, personal repository creation, managed-file commits, external-edit protection | Configure app permissions/installation and authorize a real user. Prove create/re-publish/refresh/revocation. Organization repository selection is future work. |
| Vercel integration | Integration install/code exchange, project provisioning, file deployment, status/cancel/recovery | Configure integration permissions and persistent worker. Prove successful, failed, uncertain, canceled, and reconnected jobs in the user's account/team. |
| Stripe | Recurring Checkout, Portal, signed and deduplicated webhooks, canonical subscription reconciliation | Choose prices, configure test products/portal/webhook, verify payment/cancellation/renewal/failure transitions, then separately enable live billing. |
| Operations | Auth/application write limits, worker leases/heartbeats/checkpoints, setup checker, scheduled cleanup/reconciliation command | Configure scheduler/worker host, monitoring/alerts, backup retention, restore drill, load testing, and incident ownership. |

The integrations require values in `.env.local`; none are presented as live or tested with real provider accounts. [SERVICE_SETUP.md](SERVICE_SETUP.md) gives the configuration sequence.

## Deliberate limits and remaining product work

- Guided columns support Text, Image, and Links children with two or three columns. Arbitrary freeform placement and unlimited nesting are outside the agreed guided-editor approach.
- Current motion includes entrances/stagger/hover; scroll-scrub timelines, arbitrary animation chaining, and a full motion timeline editor remain future enhancements.
- Connected publishing deploys the same files committed to GitHub, using Vercel file deployments. It does not create a Vercel Git auto-deploy connection or merge manual source changes back into the visual editor.
- Revisions retain at most 200 snapshots/project for accounts (30 locally), in addition to plan history windows. Content/media usage counts current documents and media; revision storage needs operational capacity planning.
- JSON backups reference existing private assets. Source ZIPs bundle them. Import can leave unused media if a later step fails.
- Font uploads validate the WOFF2 header and declared size; browser font decoding remains the final compatibility check. Users must supply licensed fonts.
- Contact sections link to email; a hosted contact inbox/form service, visitor analytics, collaboration, marketplace, and optional AI writing are future features.
- Final paid prices, business-specific terms/privacy/support content, data deletion/support procedures, and launch monitoring are not complete. Avoid publishing invented business policies.

## Verification evidence

- 36 automated tests passed, covering document validation, Puck integration, nested columns/links, autosave/conflicts, ownership, lifecycle, concurrent quotas, history, image variants/export, abandoned upload cleanup, trial/paid expiry, encryption, webhook signatures, repository protection, and publishing recovery/cancellation.
- TypeScript and the production Next.js app build passed.
- Real local HTTP checks passed for create/save/reload, stale-write rejection, cookie workspace isolation, invalid link rejection, cross-origin rejection, and ZIP download.
- An exported portfolio built independently to static HTML, including its sitemap and robots routes.
- Database transactions/migrations, authenticated cross-account flows, email delivery, provider authorization/deployments, and payments have not been run against external services.
- Browser tooling reported no available browser sessions. Desktop/tablet/phone visual review, actual touch drag/resize, keyboard/screen-reader walkthrough, Safari/Firefox edge rendering, screenshot parity, and measured accessibility/performance budgets remain open.

## Next release gates

1. Configure staging services using the setup guide and run migrations.
2. Verify the complete two-account create/edit/media/history/publish/billing journey, including failures and trial expiry.
3. Review rendered desktop/tablet/mobile screens and test real touch/keyboard interaction and reduced motion.
4. Measure landing/editor/exported-site performance on defined devices, complete backup/restore and monitoring, and finish business-specific launch content.
