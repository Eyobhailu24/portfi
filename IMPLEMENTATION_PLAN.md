# Portfi implementation plan

Planning date: October 15, 2026. Updated October 17, 2026. Core development now includes the full guided editor, project lifecycle, private media adapters, revisions, plan/trial enforcement, account controls, provider connections, durable publishing, and Stripe billing. Landing, backend, and workspace retain separate domains and styles.

External services are intentionally left as placeholders in .env.local at the owner's request. Implementations are present; real migrations, email/auth flows, storage permissions, cloud deployments, and payments must be verified after setup. See [SERVICE_SETUP.md](SERVICE_SETUP.md) for the exact configuration sequence and [FUNCTIONALITY_STATUS.md](FUNCTIONALITY_STATUS.md) for evidence and remaining release work.

Local automated tests and HTTP workflows, the production application build, and a standalone exported-site build have passed. Browser/device visual review and measured performance remain open because browser tooling reported no available sessions. These are release gates, not implied successes.

## Confirmed product direction

- The product name is Portfi. Use it consistently in the interface, copy, generated README files, metadata, and footer credit. The current local workspace folder can keep its existing name.
- Serve developers, designers, creatives, general job seekers, and other professionals from launch; the product is not limited to one profession.
- Build a distinctive, professional landing page with deliberate color, typography, composition, and purposeful animation. Its visual quality is a core product requirement.
- Keep landing, backend, and workspace implementation in separate folders. Share only reusable primitives, public contracts, and the portable portfolio renderer.
- Animate the landing page throughout, with smooth translucent edges, readable static content, native scrolling, and both device-level and in-page reduced-motion controls.
- Help people without coding knowledge create and publish portfolios.
- Use guided sections with drag-to-reorder, resizing, and advanced styling.
- Support multiple pages from the first release.
- Put editing controls on the left and a live preview on the right, following the simplicity the user described in FlowCV.
- Treat configurable animations as a core feature.
- Support editing and viewing on phones, tablets, and desktops.
- Publish to each user's own GitHub and Vercel accounts. Portfi does not host their public portfolios.
- Launch with one free plan and at most four plans overall; allow more plans later without rewriting feature checks.
- Give each new eligible user the second tier for their first month.
- Plan for a US business. Tier features are proposed below; prices remain to be set.
- Use Hono with TypeScript for the backend API and TanStack Query (React Query) for frontend API queries and mutations.
- Authentication belongs to the Hono backend, including sign-in routes, session validation, and protected application operations. Replace the previous Supabase Auth proposal.

## Recommended stack

| Area | Recommendation | Purpose |
| --- | --- | --- |
| Application | Next.js App Router, React, strict TypeScript | Dashboard, editor, account settings, and a thin API mount in one application |
| Backend API | Hono with TypeScript, initially mounted under /api in Next.js using the Node.js runtime | Portfolio operations, authorization, provider connections, publishing endpoints, and webhooks |
| Authentication | Hono auth routes and middleware, with Better Auth proposed as the self-hosted account/session library | Sign-in, account verification/recovery, secure sessions, and access checks owned by the backend |
| Frontend API state | TanStack Query (@tanstack/react-query) with Hono's typed RPC client | Queries, mutations, caching, invalidation, loading/error states, and publishing status |
| Visual editor | Puck open-source core with a custom Portfi interface | Component registration, nested sections, drag-and-drop, fields, and preview |
| Styling | Tailwind CSS and CSS custom properties | Editor styling and portable theme tokens |
| UI primitives | Selected @eyoben/ui components, with shadcn/ui for gaps | Reuse the user's component work after compatibility and bundle checks |
| Animation | CSS for simple effects; Motion for richer effects | A shared preset system used by preview and published portfolios |
| Validation | Zod and TypeScript contracts | Validate saved documents, component props, and server inputs |
| Persistence | Supabase PostgreSQL and Storage | Application/auth records, design documents, revisions, and uploads accessed through authorized backend operations |
| Publishing jobs | PostgreSQL leased queue, persistent TypeScript worker, GitHub/Vercel APIs | Durable snapshots/checkpoints, status, cancellation, retries, and uncertain-request reconciliation |
| Billing | Stripe Checkout, Billing, and Customer Portal | Paid subscriptions for a US business |
| Testing | Vitest, Testing Library, Playwright, and performance checks | Document logic, user journeys, exported sites, and device behavior |
| Platform deployment | Vercel for the Portfi application | Separate from the Vercel projects owned by portfolio users |

Use maintained stable versions verified together at setup, then commit the dependency lockfile. Keep the first application cohesive; extracting independent services should follow a demonstrated need.

Puck is an MIT-licensed React editor that accepts custom components. Its composition API lets us arrange the editor panels ourselves. Its viewport preview is used with Portfi responsive override/inheritance controls and custom resize handles. Puck document integration is tested; actual touch behavior and visual parity still need device review. See [Puck introduction](https://puckeditor.com/docs), [composition](https://puckeditor.com/docs/extending-puck/composition), and [viewports](https://puckeditor.com/docs/integrating-puck/viewports).

Next.js supports server/client boundaries and static exports, which fit an interactive builder and separately generated portfolio projects. See [server and client components](https://nextjs.org/docs/app/getting-started/server-and-client-components) and [static exports](https://nextjs.org/docs/app/guides/static-exports).

Hono routes and business services stay independently organized, with a thin Next.js route adapter. Start with one deployment and keep the API extractable if independent scaling becomes useful. Use Hono RPC to share request/response types with the frontend and Zod for runtime validation. See [Hono with Next.js](https://hono.dev/docs/getting-started/nextjs) and [Hono RPC](https://hono.dev/docs/guides/rpc).

Supabase remains the proposed PostgreSQL and object-storage provider. Hono owns identity and application authorization. Keep database credentials and privileged storage operations on the server; proxy private upload/download operations through Hono after checking ownership. Browser clients receive asset IDs rather than service credentials. Browser clients access application records through Hono. Use versioned migrations and restrictive database/storage grants; any row-level policies must be designed for the Hono identity model rather than relying on a Supabase Auth session. See [database overview](https://supabase.com/docs/guides/database/overview) and [storage access control](https://supabase.com/docs/guides/storage/security/access-control).

## Authentication through Hono

All account and session endpoints are served by Hono. Mount the auth implementation under /api/auth and apply session middleware to protected application routes. Hono is the request/middleware layer; it needs an account/session implementation behind those endpoints. Better Auth is the proposed self-hosted library for that role and can mount directly into Hono. See [Better Auth's Hono integration](https://better-auth.com/docs/integrations/hono).

- Store users, sessions, linked sign-in identities, and verification/recovery records in application-owned PostgreSQL tables. Associate portfolio ownership with this user ID.
- Use secure HttpOnly session cookies with deliberate expiry, renewal, logout, and session revocation. Keep session handling server-owned. See [session management](https://better-auth.com/docs/concepts/session-management).
- Include sign-up/sign-in, email verification, password recovery, and sign-out in the initial account flow. Email/password and Google are proposed entry methods; GitHub deployment authorization remains a separate capability. Use the library's credential handling and recovery primitives. See [email/password authentication](https://better-auth.com/docs/authentication/email-password).
- Apply session validation, resource ownership, plan entitlements, and quota checks in Hono and its application services. Client-side visibility does not authorize an operation.
- Apply trusted-origin/CSRF controls to cookie-authenticated mutations and protect credential/recovery endpoints against automated abuse. See [Hono CSRF middleware](https://hono.dev/docs/middleware/builtin/csrf).
- Expose current-user/session status through the application's TanStack Query integration. Clear protected query caches on sign-out; redirects follow the authentication provider's protocol.
- Verification/recovery emails need an application email adapter and configured delivery provider before production account testing. Use local/test delivery during the prototype.

Authentication implementation is an early foundation task. Test signup, verification, login/logout, expired/revoked sessions, recovery, and cross-user access before attaching publishing or billing actions.

## Brand, color, and visual direction

Portfi should feel like a carefully designed creative product with a clear editorial voice. Its landing page must demonstrate the quality of work users can produce. The marketing site, editor, and portfolio templates share quality standards but have their own visual roles: expressive marketing, calm editing, and user-controlled portfolio themes.

Proposed starting palette:

| Role | Color | Application |
| --- | --- | --- |
| Canvas | #F7F6F2, warm ivory | Main marketing background and spacious showcase areas |
| Surface | #FFFFFF | Forms, editor panels, and selected content surfaces |
| Primary ink | #151821 | Headings, navigation, and strong readable text |
| Secondary text | #555D6B | Supporting copy and labels, verified against its actual background |
| Primary accent | #2447E8, cobalt | Main calls to action, selection, focus, and small brand details |
| Dark surface | #10131A | A focused demonstration section and footer, with accessible light text |
| Border | #E3E4E8 | Decorative dividers; interactive boundaries use a stronger token when required for contrast |

Keep cobalt concentrated on meaningful actions. Use whitespace, scale, imagery, and typography to establish hierarchy. Derive hover/focus/disabled/error tokens and verify contrast for every actual color pairing. Portfolio template palettes remain independently editable and are not forced to use Portfi's brand colors.

Typography direction: a precise, readable sans serif for the interface and body, with a restrained editorial serif accent for selected marketing headlines. Manrope and Instrument Serif are candidate faces to evaluate in the first visual prototype. Use a fluid type scale, controlled line lengths, consistent spacing, and a limited set of licensed/self-hosted font files.

## Landing page composition and interaction

The page must explain what Portfi does, show credible output, and make starting a portfolio easy. Build the following sequence with distinct compositions:

1. A compact Portfi wordmark/navigation and a clear primary start action.
2. An asymmetric hero with concise copy, strong typography, and a detailed product preview showing the left-side editing workflow and the resulting portfolio.
3. A wide portfolio showcase using real templates from the product, with visible differences in audience, layout, and typography.
4. A lightweight interactive demonstration: change sample text, reorder a sample section, or apply an animation and immediately see the effect. Keep the full editor lazy-loaded outside the landing page's critical bundle.
5. A short build-to-publish sequence that makes GitHub and Vercel account ownership understandable without implementation jargon.
6. A template browser for developers, designers/creatives, and general professionals, followed by clear tier/trial information and practical FAQs.
7. A deliberate final call to action and a useful footer.

Use CSS Grid, responsive composition, fluid typography, image art direction, and small shared-element transitions to give the page depth. A restrained perspective treatment can frame the product preview if it improves the composition. Every interaction should demonstrate the product or clarify the next action.

Motion direction: approximately 150-250 ms for hover feedback and interface transitions, 280 ms for FAQ expansion, and 600-700 ms for one-time marketing reveals, with 40-100 ms stagger intervals. These are the current implementation tokens and must be tuned in the browser. Use opacity/transform for entrances and effects; animate layout height only for the actively toggled FAQ. Motion's lightweight components and lazy-loaded feature bundle belong to the landing route. Server-rendered reveal content starts visible; the full Puck editor is absent from this route's application imports. Maintain native scrolling and keyboard/touch access. Respect prefers-reduced-motion and persist the visitor's motion toggle. Measure scroll-driven effects against the performance budgets.

Surface finish: translucent header with a solid fallback, alpha borders, rounded image clipping/masks, restrained layered shadows, and local edge fades. Keep text and controls sharp. Do not apply global blur, arbitrary SVG shape-rendering overrides, permanent GPU transforms to text, or blanket will-change. Rasterization varies by browser and display density, so verify rotated image edges at normal zoom on real screens. Smooth edges must not erase focus rings or reduce contrast.

The detailed visual direction, designer selection criteria, and review checklist are in [UI_DESIGN_GUIDE.md](UI_DESIGN_GUIDE.md).

Design acceptance criteria:

- Purpose-built section layouts, disciplined alignment, consistent component details, and enough contrast between quiet and expressive sections.
- Useful, specific product copy and realistic portfolio examples spanning the confirmed audiences.
- Full desktop/mobile art direction, including the hero, demonstration, pricing, navigation, and focus states.
- Actual templates and product states provide visual proof. Testimonials, client logos, awards, and usage numbers appear only when real supporting material exists.
- Repeated generic card grids, decorative gradient blobs, excessive glass effects, filler copy, and unrelated animation do not satisfy the requested professional direction.
- Review working browser renders at phone, tablet, and desktop sizes. Revise typography, spacing, cropping, and motion until the page meets the same standard as the portfolio templates.
- Treat visual quality and measured performance as release criteria together. A static, immediately usable hero must render before optional demonstrations load.

## API calls and editor state

Frontend application API calls follow: React component -> TanStack Query hook -> typed Hono RPC client -> Hono API -> authorized service/database operation. TanStack Query owns remote data caching and synchronization. See the [TanStack Query overview](https://tanstack.com/query/latest/docs/framework/react/overview).

- Use queries for portfolios, saved revisions, assets, templates, entitlements, connections, and deployment status. Poll active publish jobs only while needed and stop on a terminal result.
- Use mutations for creating/updating projects, saving drafts, uploading through the application's upload flow, publishing, and starting checkout. Invalidate or update the relevant query caches after success.
- Normalize Hono response errors in the client layer and throw for unsuccessful responses so TanStack Query receives actual errors. Keep request cancellation and structured error messages consistent.
- Define query keys centrally, scoped to the user and relevant project/page/filter. Clear account-specific cached data when switching accounts or signing out. Set stale times and retry policies by operation; side-effecting requests require explicit idempotency handling before automatic retries.
- Use optimistic updates for reversible operations such as renaming or reordering dashboard items, with rollback and reconciliation. Do not present a publication or payment as completed before the server confirms it. See [optimistic updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates).
- Keep active document editing, selection, drag/resize interactions, and undo history in the editor's local state owner. Load the saved document through a query, then initialize the working draft. A background refetch must not overwrite unsaved edits.
- Debounce and serialize/coalesce autosave mutations per document. Include the expected server revision, advance that revision after acknowledgment, and preserve newer local edits when an older save completes. Query caching alone does not resolve write conflicts.

Authentication/provider redirects and signed file transfers may use their purpose-built protocols; their surrounding application state and API mutations still use TanStack Query. Hono serves account endpoints and validates the session on application requests. Generated static portfolios include only their own runtime requirements.

## Eyoben UI assessment

Inspected source: C:/Users/eyoba/Documents/WEB PROJECTS/EYOBEN UI/eyoben-ui.

The inspected @eyoben/ui manifest reports version 0.5.1. The component directory contains 65 TSX files, with Radix-based primitives, form inputs, color controls, file uploads, resizable editor panels, and separate optional entries for motion and rich text. Tests exist for several primitives and the component registry. This is enough implemented source to justify evaluating reuse.

Before adopting components:

- Verify keyboard behavior, focus management, touch targets, contrast, and Next.js compatibility in the actual editor.
- Measure a production consumer bundle and check that imports preserve the intended code splitting.
- Check theme behavior in an isolated preview frame.
- Add reduced-motion handling to the portfolio animation system; the inspected motion helpers do not themselves show that handling.
- Use a versioned package or reviewed source distribution. Generated user projects must not depend on a local Windows path.

This was a source review. The Eyoben build and tests were not executed. Its repository was not modified.

Eyoben UI and shadcn/ui provide primitives. Full portfolio templates still need their own layouts, typography, content structure, and responsive design.

## Editor experience

The primary journey is: choose a template, fill in content, adjust design, preview each device size, connect accounts, and publish.

Desktop layout:

- Top bar: project/page selector, undo/redo, save status, device preview, and Publish.
- Left panel: Pages, Sections, Content, Design, and Animations. Clicking a preview element selects its controls here.
- Right panel: live, isolated preview with selection outlines, drag handles, and supported resize handles.

Phones use Edit/Preview tabs and a bottom settings sheet. Tablets use collapsible panels. Reordering and sizing must also work through buttons and fields so dragging is optional.

Use progressive disclosure: content and a few useful choices appear first; detailed settings live under Advanced. Include duplication, hiding per device, resetting a property, and clear inherited-value indicators.

Multi-page features ship in the first release: create/duplicate/reorder pages, edit slugs, select a home page, manage navigation, and set page titles/descriptions/social images. Internal links reference stable page IDs so renaming a slug does not break the document. Page duplication remaps IDs. Shared headers, footers, and themes update across pages. Define redirect behavior for already-published slug changes during the publishing prototype.

Initial component set: navigation, hero, text, image, buttons/social links, about, project grid, project detail content, experience, education, skills, testimonials, gallery, contact links, and footer. Projects can link to their own detail pages at launch.

Start with approximately four polished templates covering developer project/case-study work, designer/creative visual work, professional experience/services, and a versatile general portfolio. Give each its own composition and editable palette while keeping the editing workflow consistent. Include realistic sample content for all confirmed audiences in the first visual prototype.

## Layout and responsive customization

Use a constrained hierarchy: Site -> Page -> Section -> Container/Grid -> Component. Allow nesting only where it has a clear responsive behavior.

Editable properties include text, links, media, font family/size/weight, line height, alignment, colors, backgrounds, borders, radius, shadows, padding, gaps, container width, grid columns, aspect ratios, and device visibility.

Support widths and heights where meaningful, with automatic content height as the default for text-heavy elements. Resize gestures should write responsive values such as percentages, maximum widths, and grid spans. Use clamp-based typography and spacing where useful. Offer explicit tablet/mobile overrides with inheritance from the base layout.

Preview widths must exercise real CSS breakpoints. A scaled desktop screenshot is insufficient for mobile preview. Keep mobile edit-mode controls usable independently of the selected preview width.

## Saved design, renderer, and generated source

Store a versioned structured document as the source of truth. It contains page IDs/slugs, a component tree, content, styles, theme tokens, animation settings, asset references, and schema/template/renderer versions. Keep Puck-specific integration behind an adapter so the persisted product format can evolve.

Each registered component needs a validation schema, initial values, editor fields, rendering implementation, responsive rules, animation capabilities, and export dependencies. Editor controls and drag handles stay separate from the portfolio renderer.

Architecture:

    Editor -> Validated design document -> Shared portfolio components
                                         |-> Live preview
                                         |-> Generated Next.js project -> GitHub -> Vercel

Use one document state owner inside the editor, with adapters to Puck, persistence, and history. UI-only state such as open panels must not create another copy of the document. TanStack Query manages saved server snapshots and autosave mutation status; the live working draft stays locally owned. Debounce network saves while rendering changes immediately. Record revision numbers, retain a recoverable local draft, and detect stale writes from another tab.

The exporter creates deterministic source using the same portfolio components and style rules as the preview. Include only used components, animation dependencies, optimized assets, theme CSS, page routes, metadata, a lockfile, and a README. Prefer actual generated TSX pages and component files over a dependency on the Portfi editor at runtime.

Static portfolio output is the default. Export pages with concrete routes; implement static-compatible image handling because the default Next.js image optimization server is unavailable in a pure static export. Bundle or copy media and fonts so public sites do not require Portfi credentials, signed upload URLs, or an active Portfi subscription.

Contact email/social links work in static output. A submission form needs a separately configured service or server endpoint and is outside the initial default component behavior.

Source can be downloaded and built independently. External manual code edits do not round-trip into the visual builder in the first release. Keep generated files in a documented area, retain a revision/commit association, and detect conflicting repository changes before overwriting anything.

## Animation system

Expose a small vocabulary: fade, slide, scale, stagger, hover lift, and text reveal. Add scroll progress and restrained parallax as advanced choices after profiling.

Each compatible component can expose a preset, trigger, duration, delay, easing, intensity, and repeat/once behavior. Show a replay button and a short preview when a preset is selected. Validate settings against supported ranges and use a shared motion language across templates.

Prefer opacity and transform. Reserve layout-affecting animation for cases with measured acceptable performance. Load richer motion code only when used; pause inactive/offscreen work. Respect reduced-motion settings, keep content visible if JavaScript fails, and provide a site-wide motion intensity control. See [Motion accessibility](https://motion.dev/docs/react-use-reduced-motion) and [bundle reduction](https://motion.dev/docs/react-reduce-bundle-size).

Animations are part of the free product; richer control and composition are paid differentiation. Heavy visual effects must still satisfy the same performance requirements.

## GitHub and Vercel publishing

Portfi account authentication, GitHub repository permissions, and Vercel project permissions are separate connections. Users can build before connecting deployment accounts.

Use a GitHub App with narrowly scoped access. The implementation uses its user authorization flow, including PKCE and expiring-token refresh, for repository creation and contents operations. Installation/repository access must also cover the dedicated repository. See [GitHub Apps](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/about-creating-github-apps) and [repository creation](https://docs.github.com/en/rest/repos/repos#create-a-repository-for-the-authenticated-user).

Use Vercel's integration authorization and API for team selection, project provisioning/linking, deployment state, and disconnects. Validate integration registration/review requirements early; production access is an external dependency. See [creating an integration](https://vercel.com/docs/integrations/create-integration) and [integration authentication](https://vercel.com/docs/integrations/create-integration/vercel-api-integrations).

Publishing sequence:

1. Check ownership, entitlement, document validity, and provider connection status.
2. Freeze an immutable document revision and create a publish job.
3. Generate the project and durable assets from that revision.
4. Create or update the dedicated user-owned repository with one coherent commit.
5. Create the Vercel project and deploy the exact committed files using the file-deployment API.
6. Track a deployment ID and its result; do not count a successful API request as a successful deployment.
7. Display the live URL or an actionable error and a safe retry.

Republishing currently runs through Portfi; Vercel Git auto-deploy linkage is future work. Store revision ID, commit SHA, provider account/team, repository ID, project ID, deployment ID, and URL. The implemented PostgreSQL queue uses per-project concurrency, idempotency keys, worker leases, and persisted checkpoints. Reconcile provider state before repeating a creation step, and retain uncertain deployment requests for review rather than posting duplicates. See [Vercel deployment creation](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment).

Encrypt provider credentials on the server, verify callback/webhook state and signatures, support revoked installations, and test personal accounts plus team-owned projects. Validate GitHub App-generated commits with Vercel's authorization behavior in the integration prototype.

If integration access is delayed, a clearly labeled guided repository import or [Vercel Deploy Button](https://vercel.com/docs/deploy-button) can support a beta. That fallback does not complete the fully integrated publishing requirement.

Portfi subscriptions cover builder features. Users pay any Vercel/domain charges separately. Vercel currently limits Hobby to non-commercial personal use, so commercial portfolios need an eligible provider plan. See [Vercel Hobby](https://vercel.com/docs/plans/hobby).

## Proposed tiers and first-month offer

Launch three tiers. Reserve a fourth Studio tier for a later client/team offering, once demand supports it. Names and limits are centralized in `src/shared/plans/plans.ts`; prices are supplied through Stripe configuration. Adding a plan also requires its entitlement rules and validation.

| Feature | Free | Creator: second tier | Pro |
| --- | --- | --- | --- |
| Editable portfolio projects | 1 | 3 | 10 |
| Pages per portfolio | 3 | 10 | 30 |
| Upload storage per account | 100 MB | 1 GB | 5 GB |
| Core content sections and responsive controls | Included | Included | Included |
| Templates | Starter collection | Full launch collection | Full launch collection |
| Animations | Essential presets | All standard presets, timing, and stagger | Creator features plus advanced scroll controls and reusable motion presets |
| Design controls | Core colors, typography, layout, and size | Detailed styles and per-device overrides | Creator features plus reusable personal sections and theme presets |
| GitHub/Vercel publishing and source download | Included | Included | Included |
| Revision history | Last 5 saved versions | 30 days | 90 days |
| Portfi footer credit | Shown | Optional | Optional |

All plans support multiple pages, safe responsive defaults, accessibility, and performance. Use finite provider-aware publishing rate limits and upload size limits, with the actual limits selected after integration/load measurements. Do not advertise unlimited deployments or that a Portfi subscription includes a Vercel paid plan. Custom domains remain a user-owned Vercel capability; Portfi should not claim to revoke them after a downgrade.

Prices should follow a review of storage, processing, support, conversion, and acquisition costs. Since the business will be in the US, Stripe is a suitable default for paid subscriptions; [Stripe lists the US as supported](https://stripe.com/global). Use [Checkout/Billing and subscription webhooks](https://docs.stripe.com/billing/subscriptions/overview) to maintain subscription state.

Recommended trial behavior:

- Every newly verified eligible account gets Creator for one calendar month, without a payment card.
- Record the UTC start/end timestamps on the server; define end-of-month date handling explicitly. Linking another sign-in provider does not restart the offer.
- Treat this as a Portfi feature entitlement. A Stripe subscription starts only when the user explicitly buys a paid plan. This avoids an unpaid subscription lifecycle for every free signup.
- Show the end date and explain the Free limits before users rely on trial-only features. Send an appropriate reminder through the product's future notification system.
- On expiry, use Free automatically if there is no paid subscription. No automatic payment and no deletion of saved work.
- Let users select one Free-eligible active project. Extra projects/pages stay archived or read-only within the editor.
- Keep premium designs saved. Republishing a document that exceeds Free limits or uses paid features requires upgrading or explicitly creating a Free-compatible copy; show exactly what the copy changes before applying it.
- Already exported or deployed websites continue running with their existing design, code, pages, and assets. Entitlements govern Portfi services; independent user-owned source cannot be reliably paywalled after export.
- Use verified identities and server-side eligibility records for the first-month offer, alongside ordinary account abuse controls.

Implement plans, prices, feature entitlements, and quotas as data. Avoid tier-number comparisons such as assuming every higher-numbered plan has every lower-numbered feature. Store the trial separately from subscription state so feature access resolves from paid subscription, eligible trial, or Free, in that order. Recheck entitlements on server mutations, exports, and publishes.

## Data model and boundaries

Core records: auth users; sessions; linked sign-in identities; verification/recovery records; profiles; portfolios; pages; documents and immutable revisions; assets; template/component versions; provider connections; publish jobs; deployments; plans; prices; feature definitions; plan entitlements; trial grants; subscriptions; usage counters; and processed webhook events.

Keep content JSON versioned and relational ownership explicit, referencing the Hono-backed auth library's user records. Hono services must scope each private query to the authenticated owner and enforce account/storage access independently of the browser. Record asset dependencies for each published revision. Use unique constraints for webhook event IDs and publish idempotency keys, and transactional quota reservations for concurrent operations. Enforce page-slug uniqueness inside a portfolio and validate URL/style inputs.

Implemented source structure:

```text
src/
  app/                         thin Next.js route adapters and layouts
    (landing)/                 landing route and its styles
    (workspace)/               dashboard, editor, account, preview routes
    api/                       thin Hono mount
  landing/
    components/                header, hero, templates, story, motion, plans, FAQ, footer
    motion/                    lazy animation features, reveals, preference, progress
    landing.css                landing composition and responsive layout
    polish.css                 surface finish, interactions, motion, device refinements
  backend/
    api/                       Hono routes, validation, middleware
    auth/                      Better Auth, sessions, database/email configuration
    services/                  owner-scoped persistence and conflict handling
    publishing/                source exporter and standalone dependency lockfile
    billing/                   trial arithmetic; future entitlement/payment services
  workspace/
    auth/                      sign-in, sign-up and recovery UI
    editor/                    Puck adapter, panels, controls, history, uploads, saves
    portfolios/                dashboard and portfolio preview UI
    api/                       typed Hono client and error normalization
    query/                     TanStack Query provider
    workspace.css              workspace/account surface styles
  shared/
    components/                brand, primitives, dialog, lightweight template preview
    styles/                    reset, brand tokens, fonts, shared primitives
    plans/                     public launch-plan catalogue, not entitlement enforcement
    portfolio/                 versioned schema, templates, portable renderer and CSS
  architecture.test.ts         enforced import boundaries
supabase/migrations/           PostgreSQL schema and policies
scripts/                       migrations and real HTTP/export verification
```

Dependency rules: landing and backend must not import workspace implementation. Landing imports shared public presentation/contracts only; it never loads editor, database, auth, or publishing code. Workspace consumes the backend through Hono/TanStack Query; its only direct backend import is a type-only Hono API contract. Backend never imports either UI domain. Shared never imports landing, backend, or workspace. Route adapters compose domains but contain no business logic. Shared portfolio code must remain portable into exported projects. Keep exporter filesystem paths and Next.js output tracing synchronized when moving its source inputs.

These are source boundaries in one application and deployment. Separate build processes, repositories, or a monorepo are not required for this organization. A future standalone Hono service can reuse backend services without carrying UI code.

## Performance and release criteria

Published sites and the editor get separate budgets. A public site must never ship the editor, drag-and-drop library, billing code, provider tokens, or dashboard state.

Published sites and the Portfi landing page: aim for LCP at most 2.5 seconds, INP at most 200 ms, and CLS at most 0.1 at the 75th percentile once sufficient field data exists. Lab tests gate releases until then. These are the [Core Web Vitals good thresholds](https://web.dev/articles/vitals), not results already measured for Portfi.

Optimize responsive image variants, dimensions, font loading, static HTML, cacheable assets, and only the interactive code actually used. Include animated templates in the budgets; do not claim every arbitrary user upload or effect combination has identical performance.

Editor: target p95 local input-to-preview feedback within 100 ms on a defined midrange reference device/document. Establish drag/resize frame-time and memory baselines during the prototype. Batch updates, isolate subscriptions, lazy-load heavy panels, and keep network saves off the immediate interaction path.

Test at 360px, 768px, and desktop widths, plus continuous resizing and real touch devices. Cover keyboard-only editing, reduced motion, long text, large galleries, nested layouts, and empty states. Verify the user can complete a portfolio without using drag gestures.

Critical automated scenarios: authentication/session lifecycle and recovery; save/reload and conflict recovery; page routing and internal links; preview/export visual consistency; independently building exported projects; failed/retried publishing without duplicate resources; provider disconnects; concurrent quota checks; first-month expiry; subscription webhook duplicates/order; downgrade preservation; and cross-account access isolation. Visually verify the landing page and its demonstrations across supported devices.

## Execution order

| Phase | Deliverable | Exit condition |
| --- | --- | --- |
| 1. Visual and architecture proof | Portfi color/type tokens and working landing hero/product preview; one hero, text, image, and project grid in the editor; two pages; resizing; one animation; source export; provider connection experiment | The visual direction works at desktop/mobile sizes, custom controls work on desktop/touch, export matches preview, and the integration path is proven or its external prerequisite documented |
| 2. Foundation | Hono API and authentication/session layer, TanStack Query integration, account verification/recovery, project dashboard, PostgreSQL/storage access rules, uploads, document revisions, trial grants, plan configuration | A user can securely sign up, sign in, recover access, create, save, reopen, and own a multi-page project with enforced limits |
| 3. Complete editor | Pages/navigation, section catalogue, styles, breakpoint overrides, drag/resize, undo/redo, recovery, mobile controls | The full content/design workflow works without coding on supported devices |
| 4. Landing page, templates, and motion | Complete professional landing page, lightweight demonstrations, four audience-spanning templates, reusable presets, motion controls, SEO, media optimization | Landing page and representative portfolios pass visual, accessibility, and performance checks |
| 5. Export and publishing | Standalone projects, GitHub/Vercel connections, durable publishing/status/retry, previous-revision republish | A user publishes, edits, republishes, and recovers from failures through their own accounts |
| 6. Billing and trial transitions | Checkout, customer portal, verified webhooks, Creator offer, Free fallback | Paid/free/trial transitions preserve work and enforce the documented rules |
| 7. Beta and launch | Usability sessions, device/load checks, operational dashboards, recovery documentation | New users can complete the build-and-publish journey and key release checks pass |

Build export and integration prototypes in phase 1; complete them in phase 5. Build entitlement/trial foundations in phase 2; complete payment behavior in phase 6. This makes their constraints visible before the editor and templates grow.

Current next sequence: (1) configure staging database/email/storage and run migrations, (2) prove two-account isolation and the complete account/media/history lifecycle, (3) configure GitHub/Vercel and run the persistent worker through publish/retry/cancel/reconnect scenarios, (4) verify Stripe test transitions and downgrade behavior, and (5) complete device/visual/accessibility/performance review, backup restoration, monitoring, and business-specific launch content. Core feature code is implemented; service and release acceptance remain open. See FUNCTIONALITY_STATUS.md for precise completion criteria.

Estimate delivery after phase 1 establishes the editor customization work and provider approval path. Multiple pages and robust publishing are first-release requirements and must be included in that estimate.

Later expansion: Studio/team workflows, more templates, custom template marketplace, additional deployment providers, and optional AI content assistance. Introduce each through the existing versioned component and entitlement contracts.

The first implementation milestone combines a polished Portfi landing hero/product preview with a working two-page editing-to-export prototype and a real provider integration proof. It validates both the requested visual standard and the central user journey before expanding the feature catalogue.

## Implemented architecture decisions — October 17

- Keep a single Next.js application with thin route adapters and strict landing/backend/workspace/shared boundaries. Hono owns application authorization and Better Auth endpoints; TanStack Query owns frontend API state.
- Use a PostgreSQL queue with SKIP LOCKED claims, worker leases/heartbeats, immutable snapshots, and persisted provider checkpoints. A separate persistent Node worker replaces the initial Inngest proposal. Run maintenance on an hourly trusted schedule.
- GitHub publishing currently targets a dedicated repository in the connected user's personal account. Vercel receives the exact committed files through its file-deployment API; Git auto-deploy linkage and organization/repository selection are future enhancements.
- Private assets are uploaded/read through Hono, with server-generated WebP variants. Source ZIPs include original/variant assets and fonts; JSON backups retain references to existing workspace assets.
- Guided Columns supports two or three Text/Image/Links children. Device overrides, constrained rich text, crop/focal point, custom fonts, reusable libraries, motion controls, history, and lifecycle controls are implemented. Arbitrary nested canvases and scroll-scrub timelines remain outside this delivery.
- Plan limits are authoritative on the server: Free 1 portfolio/3 pages/100 MB; Creator 3/10/1 GB; Pro 10/30/5 GB. History is 30/90 days with at most 200 account snapshots per project. Initial Creator access is granted once on first verified workspace access for one calendar month, without a card. Prices are configurable through Stripe IDs.
- Existing drafts and deployed sites survive downgrade. Publishing/export validates the current plan. The dashboard can archive excess work or create a Free-compatible copy while retaining the original.
- New source exports include canonical/social metadata, robots, sitemap, redirects, and host-configurable site origin. The portable renderer remains independent of Hono, Puck, Stripe, and account credentials.
- Legal/support content, hosted monitoring, backup/restore evidence, service setup, actual device interaction, and measured performance still require release work. No external service is claimed live before its staging acceptance passes.
