# Spec: Public Site Rendering
## Spec ID
public-site-rendering
## Status
Draft
## Linked BRD
.ai-context/BRD.md#BRD-003
## Intent
Serve the published portfolio to visitors: an anonymous read-only API that returns the current
snapshot and its files, and a Next.js page that renders that snapshot through the shared section
components inside the site shell — floating nav, anchors, footer, metadata — so that at 1440 and
390 it matches the reference boards, stays usable in between, and refreshes when the owner
publishes. Nothing on this path can read a draft.
## Context
- Builds on: .ai-context/architecture.md (Draft → publish → site, Repository layout → `apps/web`)
- Related: .ai-context/specs/publish-pipeline.spec.md, design-theme.spec.md, section-engine.spec.md,
  media-assets.spec.md, and the six section specs (each owns its own section's rendering)
- Shared facts used: .ai-context/ownership_index.md (PublishedContent · DesignSpec · Identity
  payload · Asset reference · Section type catalogue); reference: .ai-context/design_reference.md
  (Nav, Footer, Page structure, Unknowns)
## API Contract
### public-site-rendering.API01 — GET /api/v1/public/portfolio
**Auth:** none.
**Success response (200):** headers `ETag: "<contentHash>"`,
`Cache-Control: public, max-age=0, must-revalidate`.
```json
{ "success": true, "message": "ok",
  "data": { "version": 4, "publishedAt": "ISO-8601", "content": "PublishedContent" } }
```
**Exceptions:**
| Code | Condition | Response body |
|---|---|---|
| 304 | `If-None-Match` equals the current ETag | empty |
| 404 | Nothing is published | `NOT_FOUND` |
| 429 | Rate limit exceeded | `RATE_LIMITED` |
### public-site-rendering.API02 — GET /api/v1/public/assets/:id/:filename
**Auth:** none. Canonical owner of the public asset URL.
**Success response (200):** the file bytes; `Content-Type` from the stored type, `ETag` from its
SHA-256, `Cache-Control: public, max-age=3600`, `X-Content-Type-Options: nosniff`,
`Content-Disposition: inline; filename="<filename>"`.
**Exceptions:**
| Code | Condition | Response body |
|---|---|---|
| 304 | `If-None-Match` matches | empty |
| 404 | The asset is not in the **current** snapshot's `assets`, or `:filename` differs from it | `NOT_FOUND` |
| 429 | Rate limit exceeded | `RATE_LIMITED` |
### public-site-rendering.API03 — POST /api/revalidate (served by `apps/web`)
**Auth:** header `x-revalidate-secret` equal to `REVALIDATE_SECRET`.
**Success response (200):** `{ "revalidated": true }`
**Exceptions:** 401 when the header is missing or wrong (compared in constant time).
## Acceptance Criteria
1. public-site-rendering.AC1 — Given a published snapshot, when `/` is requested, then the page
   contains every section in the snapshot, in snapshot order, rendered from snapshot data only;
   and given the draft is then edited without publishing, then `/` is unchanged.
2. public-site-rendering.AC2 — Given nothing is published, when `/` is requested, then it
   returns HTTP 404 with a minimal "This portfolio has not been published yet" page marked
   `noindex`.
3. public-site-rendering.AC3 — Given a viewport of 768 or wider, when the nav renders, then it
   is a centred floating pill containing the identity's monogram in an accent circle (linking
   to the top), one link per visible in-nav section using its `navLabel` in snapshot order, with
   the `contact` section's link as a filled pill, and the résumé label as an outlined pill.
4. public-site-rendering.AC4 — Given a viewport narrower than 768, when the nav renders, then it
   shows the monogram and the résumé pill only, as on the mobile board.
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
   carries the SEO title and description, a canonical URL from `NEXT_PUBLIC_SITE_URL`, Open
   Graph and Twitter card tags (with the OG image when one is set), and a JSON-LD `Person` with
   name, job title and `sameAs` social URLs — and no email address in structured data.
9. public-site-rendering.AC9 — Given the site, when `/robots.txt` and `/sitemap.xml` are
   requested, then robots allows `/` and disallows `/cms`, and the sitemap lists `/` only.
10. public-site-rendering.AC10 — Given the snapshot's design, when the page renders, then theme
    tokens are emitted as CSS variables in the server-rendered HTML and the three fonts load
    through the allow-list, so first paint already uses the published theme.
11. public-site-rendering.AC11 — Given a new snapshot is activated, when API03 is called with
    the correct secret, then the next request for `/` renders the new snapshot; given API03 is
    never called, then `/` renders the new snapshot within 300 seconds; given a wrong secret,
    then API03 returns 401 and nothing is refreshed.
12. public-site-rendering.AC12 — Given a published snapshot, when API01 is called, then it
    returns that snapshot with an ETag; a repeat call with `If-None-Match` returns 304; and no
    request to any `/api/v1/public` route can return draft data.
13. public-site-rendering.AC13 — Given an asset that is uploaded but not in the current
    snapshot, when API02 is requested for it, then the response is 404; given it is in the
    current snapshot, then the bytes are returned with the headers in API02.
14. public-site-rendering.AC14 — Given the seed content with its placeholder replaced and
    published, when full-page screenshots are taken at 1440 and 390, then the owner approves
    them against `docs/design-reference/desktop-1440.jpg` and `mobile-390.jpg` as the baselines;
    and afterwards every run matches its baseline within a 1% pixel-difference ratio.
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
## Edge Cases Covered
- A snapshot with only the hero: the nav shows the monogram (and résumé pill if any); no empty
  link row.
- A snapshot whose `contact` section is hidden: no filled pill; the hero's contact CTA cannot
  exist in that snapshot because `publish-pipeline` blocks it.
- A request for `/#work` on first load scrolls to the section after render.
- An older snapshot activated by rollback references a variant id that is no longer in the
  catalogue: it still resolves (`design-theme` edge case).
- The year in the footer is the render-time year, so a long-cached page can show last year's
  until the next revalidation — accepted.
## Error Handling
- API01 404 → the not-published page (AC2). Network or 5xx → stale page or 503 (AC17).
- An unknown section type in a snapshot is skipped by the composer (`section-engine.AC14`).
- A renderer that throws is contained by a per-section error boundary; the rest of the page
  renders and the error is logged with the section type.
- API03 never reveals whether the secret was close; 401 is the only failure.
## Unit Test Cases (spec-derived)
| Test ID | Maps to AC | Scenario | Expected |
|---|---|---|---|
| public-site-rendering.UT01 | AC12 | `PublicSiteService.getCurrent` with and without a snapshot (fake reader) | Content + hash / not-found |
| public-site-rendering.UT02 | AC13 | `getPublishedAsset` for an id in / not in the manifest, and a wrong filename | Stream / not-found / not-found |
| public-site-rendering.UT03 | AC3 | `buildNavModel` from a snapshot with one hidden and one `showInNav: false` section | Only visible in-nav sections, in order; contact flagged |
| public-site-rendering.UT04 | AC5 | `buildNavModel` with and without a résumé asset | Résumé item present with the API02 URL / absent |
| public-site-rendering.UT05 | AC7 | Footer with a fixed clock | Correct year, name and joined credits |
| public-site-rendering.UT06 | AC8 | `buildMetadata` and `buildPersonJsonLd` | Expected tags; no email in JSON-LD |
| public-site-rendering.UT07 | AC16 | `adaptSnapshot` with version 1 and version 2 | Props / unsupported-version error |
| public-site-rendering.UT08 | AC11 | Revalidate handler with a right, wrong and missing secret | 200 / 401 / 401 |
## Open Questions
1. **OQ1 — Navigation behaviour.** (a) The mobile board shows no way to reach sections from the
   nav; is that intended, or should a menu be added? (b) `Contact` is a filled pill on the
   desktop board — is that a permanent emphasis (as specified) or an "active section" state?
   (c) Does the nav stay fixed while scrolling?
2. **OQ2 — Motion and hover.** Scroll reveals, hover and pressed states and transitions are not
   visible in still images. Until specified, only focus styles and the marquee are implemented.
## Explicitly Out of Scope
- Each section's internal layout — the six section specs.
- Analytics, cookie banners, a blog, a contact form, search.
- Multiple pages, locales or portfolios; custom domains per portfolio.
- Draft preview on the public origin — preview lives in the CMS.
- Image optimisation pipelines and a CDN.
## Non-Functional Constraints (from constitution.md)
- WCAG 2.1 AA.
- Performance targets (Core Web Vitals, Lighthouse) are not yet defined — set from the first
  measured baseline after `T07`.
- No latency target is defined yet for API01 and API02.
- No client-side data fetching on the public page.
