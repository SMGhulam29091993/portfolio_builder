# Spec: Public Site Rendering
## Spec ID
public-site-rendering
## Status
Implemented
- `In Progress → Implemented` on 2026-10-21: T01–T08 completed (DoD self-checks in
  `state/completed.md`). Recorded deviations: (1) AC17's "temporarily unavailable" page answers
  HTTP 500, not 503 — a Next.js page can only end in 200, 404 or its error boundary's 500;
  (2) E2E12 (stopping the API mid-run) is covered by `published-source.spec.ts`, because the
  shared E2E harness cannot stop its API without failing every later journey; (3) UT09 (the
  mobile menu) runs in E2E04, as `packages/sections` has no DOM test environment; (4) the first
  performance baseline is measured at the first deployment (Non-Functional Constraints).
- `Ready → In Progress` on 2026-10-21 with `public-site-rendering.T01` started.
- DoR self-check: 2026-10-21, pass. Moved `Draft → Ready` by the agent under the owner's
  standing authorisation of 2026-10-20 (`governance.md`).
- Revised 2026-10-21, before the spec was ever `Ready`, for ADR-0010 and the owner's answers of
  2026-10-20: (1) every portfolio is served at `<platform>/<slug>` — API01 and API02 take the
  slug, API03 revalidates one slug, and a new API04 lists published portfolios for the sitemap;
  an unknown slug and an unpublished portfolio answer the same 404, so existence is not
  revealed; (2) `/` is the platform home (AC20) — a portfolio on a bare domain is
  `custom-domains`; (3) OQ1 and OQ2 resolved from the owner's answers of 2026-10-20 in
  `design_reference.md` — see Resolved Questions; AC4 gains the mobile menu; (4) AC14 asserts layout at the reference widths
  instead of owner-approved pixel baselines, as the section specs did (2026-10-20); full-page
  screenshots are still captured for the owner to review; (5) `DEFAULT_PORTFOLIO_SLUG` is
  retired — the slug comes from the URL.
## Linked BRD
.ai-context/BRD.md#BRD-003
## Intent
Serve each published portfolio to visitors at `<platform>/<slug>`: an anonymous read-only API
that returns a portfolio's current snapshot and its files, and a Next.js page that renders that
snapshot through the shared section components inside the site shell — floating nav, anchors,
footer, metadata — so that at 1440 and 390 it matches the reference boards, stays usable in
between, and refreshes when its owner publishes. Nothing on this path can read a draft. The
platform's own root shows a minimal home page.
## Context
- Builds on: .ai-context/architecture.md (Draft → publish → site, Repository layout → `apps/web`)
- Related: .ai-context/specs/publish-pipeline.spec.md, design-theme.spec.md, section-engine.spec.md,
  media-assets.spec.md, and the six section specs (each owns its own section's rendering)
- Shared facts used: .ai-context/ownership_index.md (PublishedContent · DesignSpec · Identity
  payload · Asset reference · Section type catalogue); reference: .ai-context/design_reference.md
  (Nav, Footer, Page structure, Unknowns)
## API Contract
### public-site-rendering.API01 — GET /api/v1/public/portfolios/:slug
**Auth:** none. `:slug` follows the slug rules (`section-engine` → Portfolio provisioning).
**Success response (200):** headers `ETag: "<contentHash>"`,
`Cache-Control: public, max-age=0, must-revalidate`.
```json
{ "success": true, "message": "ok",
  "data": { "slug": "ada", "version": 4, "publishedAt": "ISO-8601", "content": "PublishedContent" } }
```
**Exceptions:**
| Code | Condition | Response body |
|---|---|---|
| 304 | `If-None-Match` equals the current ETag | empty |
| 404 | No portfolio has the slug, or it has nothing published (one answer for both) | `NOT_FOUND` |
| 429 | Rate limit exceeded | `RATE_LIMITED` |
### public-site-rendering.API02 — GET /api/v1/public/portfolios/:slug/assets/:id/:filename
**Auth:** none. Canonical owner of the public asset URL.
**Success response (200):** the file bytes; `Content-Type` from the stored type, `ETag` from its
SHA-256, `Cache-Control: public, max-age=3600`, `X-Content-Type-Options: nosniff`,
`Content-Disposition: inline; filename="<filename>"`.
**Exceptions:**
| Code | Condition | Response body |
|---|---|---|
| 304 | `If-None-Match` matches | empty |
| 404 | The portfolio has no current snapshot, the asset is not in that snapshot's `assets`, or `:filename` differs from it | `NOT_FOUND` |
| 429 | Rate limit exceeded | `RATE_LIMITED` |
### public-site-rendering.API03 — POST /api/revalidate (served by `apps/web`)
**Auth:** header `x-revalidate-secret` equal to `REVALIDATE_SECRET`.
**Request payload:** `{ "slug": "ada" }` — the portfolio whose page to re-render.
**Success response (200):** `{ "revalidated": true }`
**Exceptions:** 401 when the header is missing or wrong (compared in constant time), checked
before the body; 400 when `slug` is missing or malformed.
### public-site-rendering.API04 — GET /api/v1/public/portfolios
**Auth:** none. For the sitemap.
**Success response (200):** `data: { "portfolios": [ { "slug": "ada", "publishedAt": "ISO-8601" } ] }`
— every portfolio with a live snapshot, by slug; nothing else about them.
**Exceptions:** 429 `RATE_LIMITED`.
## Acceptance Criteria
1. public-site-rendering.AC1 — Given a published snapshot, when `/<slug>` is requested, then the
   page contains every section in the snapshot, in snapshot order, rendered from snapshot data
   only; and given the draft is then edited without publishing, then `/<slug>` is unchanged.
2. public-site-rendering.AC2 — Given nothing is published for a slug, or no portfolio has it,
   when `/<slug>` is requested, then it returns HTTP 404 with a minimal "This portfolio has not
   been published yet" page marked `noindex` — the same page in both cases.
3. public-site-rendering.AC3 — Given a viewport of 768 or wider, when the nav renders, then it
   is a centred floating pill containing the identity's monogram in an accent circle (linking
   to the top), one link per visible in-nav section using its `navLabel` in snapshot order, with
   the `contact` section's link as a filled pill, and the résumé label as an outlined pill.
4. public-site-rendering.AC4 — Given a viewport narrower than 768, when the nav renders, then it
   shows the monogram and the résumé pill, as on the mobile board, plus a "Menu" button that
   opens and closes the section links (`aria-expanded`; Escape and choosing a link close it).
5. public-site-rendering.AC5 — Given the snapshot has a résumé asset, when the résumé pill is
   activated, then the file opens in a new tab from API02; given it has none, then no résumé
   pill is rendered at any width.
6. public-site-rendering.AC6 — Given a nav link or an in-page call to action, when it is
   activated, then the page moves to the section whose element id is its type, focus moves to
   that section's heading, and the URL hash updates; and the first focusable element on the page
   is a "Skip to content" link.
7. public-site-rendering.AC7 — Given the footer, when it renders, then it shows `©`, the year
   at render time and the identity's `copyrightName` on one side and `Built with` followed by
   `builtWith` joined with middle dots on the other; at 390 the two lines are stacked and
   centred.
8. public-site-rendering.AC8 — Given a published snapshot, when the page head renders, then it
   carries the SEO title and description, a canonical URL `NEXT_PUBLIC_SITE_URL` + `/<slug>`, Open
   Graph and Twitter card tags (with the OG image when one is set), and a JSON-LD `Person` with
   name, job title and `sameAs` social URLs — and no email address in structured data.
9. public-site-rendering.AC9 — Given the site, when `/robots.txt` and `/sitemap.xml` are
   requested, then robots allows `/` and disallows `/cms` and `/api`, and the sitemap lists `/`
   and every published portfolio's `/<slug>` (from API04).
10. public-site-rendering.AC10 — Given the snapshot's design, when the page renders, then theme
    tokens are emitted as CSS variables in the server-rendered HTML and the three fonts load
    through the allow-list, so first paint already uses the published theme.
11. public-site-rendering.AC11 — Given a new snapshot is activated, when API03 is called with
    the correct secret and the slug, then the next request for `/<slug>` renders the new
    snapshot and no other portfolio's page is refreshed; given API03 is never called, then
    `/<slug>` renders the new snapshot within 300 seconds; given a wrong secret, then API03
    returns 401 and nothing is refreshed.
12. public-site-rendering.AC12 — Given a published snapshot, when API01 is called with its
    slug, then it returns that snapshot with an ETag; a repeat call with `If-None-Match` returns
    304; no request to any `/api/v1/public` route can return draft data; and no portfolio's
    route can return another portfolio's snapshot or files.
13. public-site-rendering.AC13 — Given an asset that is uploaded but not in the current
    snapshot, when API02 is requested for it, then the response is 404; given it is in the
    current snapshot, then the bytes are returned with the headers in API02.
14. public-site-rendering.AC14 — Given the seed content with its placeholder replaced and
    published, when the page renders at 1440 and at 390, then the layout matches the reference
    boards' structure — nav pill centred (1440) or monogram + résumé (390), sections stacked in
    order full width, footer last with its two lines side by side (1440) or stacked (390) — as
    asserted from element geometry; and full-page screenshots at both widths are saved with the
    test results for the owner to compare with `docs/design-reference/desktop-1440.jpg` and
    `mobile-390.jpg`.
15. public-site-rendering.AC15 — Given viewports of 390, 768, 1024 and 1440, when the page
    renders, then there is no horizontal page scroll, no overlapping text and no clipped
    content.
16. public-site-rendering.AC16 — Given a snapshot whose `schemaVersion` the site supports, when
    it renders, then it is passed through that version's adapter to the current renderer props;
    given an unsupported higher version, then the page returns HTTP 500 with a plain error page
    and logs the version.
17. public-site-rendering.AC17 — Given the API is unreachable, when `/` is requested, then the
    last successfully rendered page is served; given there is none, then a plain "temporarily
    unavailable" page with HTTP 503.
18. public-site-rendering.AC18 — Given JavaScript is disabled, when `/` loads, then all content,
    navigation anchors and the mail link work; only the copy-email chip and marquee motion are
    inactive.
19. public-site-rendering.AC19 — Given the rendered page, when it is audited, then it has
    `header`, `nav`, `main` and `footer` landmarks, exactly one `h1`, no skipped heading level,
    a visible focus indicator on every interactive element, and no serious or critical automated
    accessibility violation at either reference width.
20. public-site-rendering.AC20 — Given the platform root `/`, when it is requested, then it is a
    minimal home page — the product name, one sentence on what it does, and links to sign in and
    to create an account (both under `/cms`) — that shows no portfolio's data and is indexable.
## Edge Cases Covered
- A snapshot with only the hero: the nav shows the monogram (and résumé pill if any); no empty
  link row.
- A snapshot whose `contact` section is hidden: no filled pill; the hero's contact CTA cannot
  exist in that snapshot because `publish-pipeline` blocks it.
- A request for `/<slug>#work` on first load scrolls to the section after render.
- A slug that breaks the slug rules, or is reserved (`cms`, `api`, …), never reaches API01: the
  page answers the not-published 404 at once.
- An older snapshot activated by rollback references a variant id that is no longer in the
  catalogue: it still resolves (`design-theme` edge case).
- The year in the footer is the render-time year, so a long-cached page can show last year's
  until the next revalidation — accepted.
## Error Handling
- API01 404 → the not-published page (AC2). Network or 5xx → stale page or 503 (AC17).
- API04 failing leaves the sitemap with `/` only; it never fails the request.
- An unknown section type in a snapshot is skipped by the composer (`section-engine.AC14`).
- A renderer that throws is contained by a per-section error boundary; the rest of the page
  renders and the error is logged with the section type.
- API03 never reveals whether the secret was close; 401 is the only failure.
## Unit Test Cases (spec-derived)
| Test ID | Maps to AC | Scenario | Expected |
|---|---|---|---|
| public-site-rendering.UT01 | AC12 | `PublicSiteService.getCurrent(slug)` with and without a snapshot, and an unknown slug (fake reader) | Content + hash / not-found / not-found |
| public-site-rendering.UT02 | AC13 | `getPublishedAsset(slug, id, filename)` for an id in / not in the manifest, and a wrong filename | Stream / not-found / not-found |
| public-site-rendering.UT03 | AC3 | `buildNavModel` from a snapshot with one hidden and one `showInNav: false` section | Only visible in-nav sections, in order; contact flagged |
| public-site-rendering.UT04 | AC5 | `buildNavModel` with and without a résumé asset | Résumé item present with the API02 URL / absent |
| public-site-rendering.UT05 | AC7 | Footer with a fixed clock | Correct year, name and joined credits |
| public-site-rendering.UT06 | AC8 | `buildMetadata` and `buildPersonJsonLd` | Expected tags; no email in JSON-LD |
| public-site-rendering.UT07 | AC16 | `adaptSnapshot` with version 1 and version 2 | Props / unsupported-version error |
| public-site-rendering.UT08 | AC11 | Revalidate handler with a right, wrong and missing secret; a right secret without a slug | 200 / 401 / 401 / 400 |
| public-site-rendering.UT09 | AC4 | Mobile menu: toggle, Escape, choosing a link | Opens with `aria-expanded="true"`; closes each way |
## Resolved Questions
Answered by the owner on 2026-10-20 (`design_reference.md` → Owner answers, rows 3, 4 and 7):
1. **OQ1 — Navigation behaviour.** (a) Below 768 a "Menu" button opens the section links under
   the bar (AC4). (b) `Contact` is a permanent filled pill, not an active-section state. (c) The
   nav pill is fixed while scrolling; section anchors leave room for it (`scroll-margin-top`).
2. **OQ2 — Motion and hover.** Sections fade up once when they enter the viewport; the marquee
   loops leftward in about 40 s and pauses on hover and focus; buttons and cards brighten their
   border on hover; in-page jumps scroll smoothly. All motion is off under
   `prefers-reduced-motion` and when the theme's motion is `none`. The fade-up hides nothing
   until script has run, so with JavaScript off every section is visible (AC18).
## Explicitly Out of Scope
- Each section's internal layout — the six section specs.
- Analytics, cookie banners, a blog, a contact form, search.
- Multiple pages per portfolio, locales; custom domains (`custom-domains`).
- Draft preview on the public origin — preview lives in the CMS.
- Image optimisation pipelines and a CDN.
## Non-Functional Constraints (from constitution.md)
- WCAG 2.1 AA.
- Performance targets (Core Web Vitals, Lighthouse) are not yet defined — set from the first
  baseline measured on the first deployment (a `next dev` measurement would mislead).
- No latency target is defined yet for API01 and API02.
- No client-side data fetching on the public page.
