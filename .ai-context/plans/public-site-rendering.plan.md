# Plan: Public Site Rendering
## Derived From
.ai-context/specs/public-site-rendering.spec.md
## Architecture Approach
**API — module `apps/api/src/modules/public-site/`**, module file pattern, no repository of its own.
| Class | Layer | Implements | Depends on (interfaces) |
|---|---|---|---|
| `PublicSiteController` | Controller | — | `IPublicSiteService` |
| `PublicSiteService` | Service | `IPublicSiteService` | `ISnapshotReader` (from `publishing` — `getCurrentForSlug(slug)`), `IAssetReader` (from `assets`), `Env` (`DEFAULT_PORTFOLIO_SLUG`) |
- It depends on read-only interfaces only; no draft interface is importable from this module —
  the architecture test asserts it. The module-level edges (`public-site → publishing, assets`)
  are already enforced by `apps/api/src/architecture/`; T01 extends that test with the
  interface-level check (named imports from `publishing`'s index limited to `ISnapshotReader`).
- Conditional GET (ETag / 304) is handled in the controller; caching headers are set there too.
- A dedicated rate limiter instance covers `/api/v1/public`.

**Web — `apps/web/src/app/(site)/`**
- Replaces the `monorepo-foundation.T08` placeholder `page.tsx`. `API_INTERNAL_URL`,
  `NEXT_PUBLIC_SITE_URL` and `REVALIDATE_SECRET` are read through `src/lib/env.ts` only, each
  added there and to `turbo.json` in the same change (`architecture.md` → Environment).
- `lib/published.ts` — server-only fetch of API01 with a cache tag and a 300-second time-based
  fallback; maps 404 / network failure to typed results.
- `page.tsx` — Server Component: fetch → `adaptSnapshot` (per `schemaVersion`) → `ThemeStyle` →
  `SiteNav` → `PortfolioPage` (from `packages/sections`) → `SiteFooter`.
- `SiteNav`, `SiteFooter`, `SkipLink` live in `packages/sections/src/shell/` so the CMS preview
  shows the same shell.
- `generateMetadata`, `robots.ts`, `sitemap.ts`, JSON-LD script.
- `app/api/revalidate/route.ts` — constant-time secret check, then tag revalidation.
- `AnchorFocus` — tiny client helper moving focus to the target heading after hash navigation.
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
- Mobile section menu, fixed nav, scroll reveals, hover states — blocked on OQ1 and OQ2.
- Edge caching / CDN in front of the site — hosting is undecided.
- Multi-portfolio routing by slug or domain.
## Sequencing
1. API module: snapshot and asset delivery
2. Web: published fetch, page composition, empty and error states
3. Revalidation route and caching
4. Shell: nav, skip link, anchors, footer
5. Metadata, JSON-LD, robots, sitemap
6. Responsive pass
7. Visual baselines, accessibility audit, first performance measurement
8. Snapshot version adapter and failure pages
