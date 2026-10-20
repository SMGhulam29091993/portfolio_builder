# Tasks: Public Site Rendering
## Derived From
.ai-context/plans/public-site-rendering.plan.md
## Sequence
- [x] public-site-rendering.T01 — `public-site` API module: `PublicSiteService`, controller with ETag / 304 and cache headers, public rate limiter, routes for API01, API02 and API04 by slug, `listPublished` through the pointer reader, container wiring, OpenAPI; architecture-test rule forbidding draft interfaces here — Acceptance: AC9, AC12, AC13
- [x] public-site-rendering.T02 — `lib/published.ts`, `(site)/[slug]/page.tsx` composing `ThemeStyle` + `PortfolioPage`, the not-published page, the platform home at `/` — Acceptance: AC1, AC2, AC10, AC20
- [x] public-site-rendering.T03 — Tag-based caching with a 300 s fallback and `app/api/revalidate/route.ts` with a constant-time secret check and the slug's tag; confirm the caching API against the installed Next.js version first — Acceptance: AC11
- [x] public-site-rendering.T04 — Shell in `packages/sections/src/shell/`: `SiteNav` (≥ 768 and < 768, with the mobile menu), `SkipLink`, section anchors + `AnchorFocus`, `SiteFooter` — Acceptance: AC3, AC4, AC5, AC6, AC7
- [x] public-site-rendering.T05 — `generateMetadata`, JSON-LD `Person`, `robots.ts`, `sitemap.ts` — Acceptance: AC8, AC9
- [x] public-site-rendering.T06 — Responsive pass at 390 / 768 / 1024 / 1440 across the shell and all six sections — Acceptance: AC15
- [x] public-site-rendering.T07 — Layout assertions and full-page screenshots at 1440 and 390 for owner review; accessibility audit; JS-disabled check; first performance measurements moved to the first deployment (a `next dev` measurement would mislead; spec → Non-Functional Constraints) — Acceptance: AC14, AC18, AC19
- [x] public-site-rendering.T08 — `adaptSnapshot` version adapter, unsupported-version page, stale-on-error and 503 handling, per-section error boundary — Acceptance: AC16, AC17
