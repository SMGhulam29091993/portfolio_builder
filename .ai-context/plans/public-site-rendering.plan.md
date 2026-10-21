# Plan: Public Site Rendering
## Derived From
.ai-context/specs/public-site-rendering.spec.md
## Architecture Approach
**API — module `apps/api/src/modules/public-site/`**, module file pattern, no repository of its own.
| Class | Layer | Implements | Depends on (interfaces) |
|---|---|---|---|
| `PublicSiteController` | Controller | — | `IPublicSiteService` |
| `PublicSiteService` | Service | `IPublicSiteService` | `ISnapshotReader` (from `publishing` — `getCurrentForSlug(slug)`, `listPublished()`), `IAssetReader` (from `assets`) |
- It depends on read-only interfaces only; no draft interface is importable from this module —
  the architecture test asserts it. The module-level edges (`public-site → publishing, assets`)
  are already enforced by `apps/api/src/architecture/`; T01 extends that test with the
  interface-level check (named imports from `publishing`'s index limited to `ISnapshotReader`).
- Conditional GET (ETag / 304) is handled in the controller; caching headers are set there too.
- A dedicated rate limiter instance covers `/api/v1/public`.
- Revised 2026-10-21 (spec revision): the slug comes from the route (`/public/portfolios/:slug`),
  so `DEFAULT_PORTFOLIO_SLUG` is retired; `ISnapshotReader` gains `listPublished()` (API04),
  served by `IPublishedPointerReader.listPublished()` in `portfolio`.

**Web — `apps/web/src/app/(site)/`**
- `(site)/page.tsx` becomes the platform home (AC20); `(site)/[slug]/page.tsx` renders a
  portfolio. A slug failing `slugSchema` or listed in `RESERVED_SLUGS` answers 404 without a
  fetch. `API_INTERNAL_URL`,
  `NEXT_PUBLIC_SITE_URL` and `REVALIDATE_SECRET` are read through `src/lib/env.ts` only, each
  added there and to `turbo.json`, and uncommented in `apps/web/.env.example`, in the same
  change (`architecture.md` → Environment; `lib/env-example.spec.ts` fails otherwise).
- `lib/published.ts` — server-only fetch of API01 with a per-slug cache tag
  (`portfolio:<slug>`) and a 300-second time-based fallback; maps 404 / network failure to typed
  results.
- `page.tsx` — Server Component: fetch → `adaptSnapshot` (per `schemaVersion`) → `ThemeStyle` →
  `SiteNav` → `PortfolioPage` (from `packages/sections`) → `SiteFooter`.
- `SiteNav`, `SiteFooter`, `SkipLink` live in `packages/sections/src/shell/` so the CMS preview
  shows the same shell.
- `generateMetadata`, `robots.ts`, `sitemap.ts`, JSON-LD script.
- `app/api/revalidate/route.ts` — constant-time secret check, then revalidation of the one
  slug's tag.
- `AnchorFocus` — tiny client helper moving focus to the target heading after hash navigation.
- `MobileMenu` — client disclosure below 768 (OQ1 resolved); the links are server-rendered, so
  with JavaScript off the sections are still reachable through the skip link and the page.
- `RevealOnScroll` — client helper (OQ2 resolved): after mount, and only when motion is allowed,
  marks below-the-fold sections pending and reveals each once it intersects the viewport.
- Patterns: Adapter (snapshot version adapters, keyed by `schemaVersion`).
## Data Model
None. Reads `snapshots` through `ISnapshotReader` and file bytes through `IAssetReader`.
## Constitution Check
- [x] No new datastore introduced without ADR
- [x] Draft isolation enforced by dependency direction and tested (AC12, AC13)
- [x] Only read interfaces cross into this module (Interface Segregation)
- [x] Older snapshots stay renderable (`schemaVersion` adapters)
- [x] Accessibility is an acceptance criterion
- [ ] Non-functional baselines for the public page — not yet defined; measured in T07
## Explicitly Deferred
- Edge caching / CDN in front of the site — hosting is undecided.
- Routing by custom domain — `custom-domains`.
## Sequencing
1. API module: snapshot and asset delivery
2. Web: published fetch, page composition, empty and error states
3. Revalidation route and caching
4. Shell: nav, skip link, anchors, footer
5. Metadata, JSON-LD, robots, sitemap
6. Responsive pass
7. Visual baselines, accessibility audit, first performance measurement
8. Snapshot version adapter and failure pages
