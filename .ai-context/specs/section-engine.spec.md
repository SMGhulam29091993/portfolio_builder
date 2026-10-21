# Spec: Section Engine
## Spec ID
section-engine
## Status
Implemented
- `In Progress → Implemented` on 2026-10-20: T01–T07 completed, each with a DoD self-check line
  in `state/completed.md`.
- `Ready → In Progress` on 2026-10-20 with `section-engine.T01` started.
- DoR self-check: 2026-10-20, pass. Moved `Draft → Ready` by the agent under the owner's
  standing authorisation of 2026-10-20 (`governance.md`); ADR-0005 accepted 2026-10-20.
- Revised 2026-10-20, before the spec was ever `Ready` (no `⚠️ REVISED` marker needed), for
  ADR-0010 and its owner answers: one portfolio per user, provisioned on the user's first CMS
  request from the reference template (design kept, content replaced by placeholders); tenant
  isolation; the portfolio slug (a free portfolio is served at `<platform>/<slug>`); item ids
  from Node's `crypto` (no new dependency). Added: Portfolio provisioning, Slug rules, API06,
  AC15–AC18, UT13–UT16.
## Linked BRD
.ai-context/BRD.md#BRD-001
## Intent
Give each signed-in user one portfolio of their own, and the CMS one generic way to read, edit,
hide and reorder its page sections; give the codebase one way to add a section type. Each type plugs a definition (schema, defaults,
flags) into a registry on the API and a renderer into a registry on the web; the engine, its
endpoints and the page composer never change when a type is added. This spec owns the engine
and the payload primitives every section shares; each section's own payload is owned by its own
spec.
## Context
- Builds on: .ai-context/architecture.md (Section type catalogue, API modules → `portfolio`)
- Related: .ai-context/decisions/ADR-0005-section-registry-content-model.md; the six section specs
- Shared facts used: .ai-context/ownership_index.md (Optimistic concurrency · Session contract ·
  Section type catalogue · Response envelope and canonical error codes)
## Shared payload primitives
Canonical owner (`ownership_index.md`). Defined once in `packages/contracts/src/sections/primitives.ts`.
| Type | Shape | Limits |
|---|---|---|
| `PlainText(n)` | string | Trimmed; HTML tags and control characters stripped on write; 1..n characters unless marked optional |
| `EmphasisHeading` | `{ lead: string, emphasis: string }` | `lead` 1..80; `emphasis` 0..48 (rendered in the italic serif accent) |
| `SectionMeta` | `{ eyebrow: string, navLabel: string, showInNav: boolean }` | `eyebrow` 1..32; `navLabel` 1..16 |
| `Metric` | `{ value: string, label: string }` | `value` 1..12; `label` 1..80 |
| `Tag` | string | 1..24 |
| `LinkTarget` | `{ kind: "section", sectionType }` \| `{ kind: "url", url }` | `url` is `https:` or `mailto:`, ≤ 2048 |
| `ItemId` | string | Server-assigned when absent; unique within its list; never changes |
Section numbers (`01`, `02`, …) are **not** stored — they are derived from visible order.

`ItemId` assignment is generic: every object inside an array in a section's `data` is a list
item. Its schema declares `id` through the shared `listItem({...})` helper (optional on input);
after validation the engine assigns a 12-character URL-safe random id (72 bits, Node `crypto`)
to each item without one and rejects duplicates within the same array. Arrays of strings
(`Tag[]`) are not items.

## Portfolio provisioning (ADR-0010)
- Every user has exactly one portfolio (`portfolios.userId` unique). The first `/api/v1/cms`
  request after the guard that finds none creates it: `resolvePortfolio` creates the portfolio
  and one `sections` document per registered type, from each definition's `defaults()`, all
  `visible: true`, `sectionOrder` = the orderable types in registration order.
- `defaults()` is the reference template: the reference design's structure with **placeholder
  content** in square brackets (`[Your headline]`), never the owner's own content. The
  placeholders satisfy the schema, so the CMS can render and edit them at once, and
  `publish-pipeline`'s placeholder rule blocks publishing until each is replaced.
- The owner's reference content is seed data for the development account only (`seed:all`).
- Provisioning is idempotent under races: the unique indexes on `portfolios.userId` and
  `{ portfolioId, type }` decide; a request that loses the race reads the winner's documents.

## Slug rules
| Rule | Value |
|---|---|
| Shape | `^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$` — 3..40 characters, lower-case letters, digits, single inner hyphens |
| Unique | Across all portfolios (unique index) |
| Reserved | `api`, `cms`, `admin`, `login`, `register`, `_next`, `static`, `assets`, `favicon.ico`, `robots.txt`, `sitemap.xml`, `health`, `public`, `www`, `app`, `help`, `about`, `pricing`, `terms`, `privacy` |
| Initial | From the display name: lower-cased, non-alphanumerics → `-`, trimmed to 32; empty or reserved → `portfolio`; taken → suffixed `-2`, `-3`, … |
## API Contract
All routes require a signed-in session (`requireOwner`, `owner-auth`) and act only on the
signed-in user's own portfolio, resolved (or provisioned) by `resolvePortfolio`. No route takes
a portfolio id: another user's portfolio cannot be named, let alone read (`constitution.md` →
Tenant isolation).
### section-engine.API01 — GET /api/v1/cms/portfolio
**Success response (200):**
```json
{ "success": true, "message": "ok", "data": {
  "portfolio": { "id": "string", "slug": "string", "revision": 3,
                 "sectionOrder": ["about", "work", "experience", "stack", "contact"] },
  "sections": [ { "type": "hero", "visible": true, "revision": 1,
                  "updatedAt": "ISO-8601", "data": { } } ] } }
```
`sectionOrder` lists orderable types only; `hero` is always rendered first.
**Exceptions:** 401 `UNAUTHENTICATED` / `SESSION_EXPIRED` (the guard — `owner-auth` → Request authorization).
### section-engine.API02 — GET /api/v1/cms/portfolio/section-types
**Success response (200):**
```json
{ "data": { "types": [ { "type": "about", "label": "About",
  "orderable": true, "hideable": true, "inNav": true } ] } }
```
**Exceptions:** 401 `UNAUTHENTICATED` / `SESSION_EXPIRED` (the guard — `owner-auth` → Request authorization).
### section-engine.API03 — PUT /api/v1/cms/portfolio/sections/:type
**Request payload:**
```json
{ "expectedRevision": 1, "data": { "…": "payload owned by that section's spec" } }
```
**Success response (200):** `data: { "section": { "type", "visible", "revision", "updatedAt", "data" } }`
**Exceptions:**
| Code | Condition | Response body |
|---|---|---|
| 400 | `data` fails that type's schema, or a list has duplicate item ids | `VALIDATION_FAILED` with paths relative to `data` |
| 401 | No valid session; a superseded session | `UNAUTHENTICATED`; `SESSION_EXPIRED` |
| 403 | `Origin` not allowed | `ORIGIN_NOT_ALLOWED` |
| 404 | `:type` is not registered | `NOT_FOUND` |
| 409 | `expectedRevision` is stale | `REVISION_CONFLICT`, `currentRevision` |

For a type with no stored document (AC18), `expectedRevision: 0` creates it.
### section-engine.API04 — PATCH /api/v1/cms/portfolio/sections/:type/visibility
**Request payload:** `{ "expectedRevision": 1, "visible": false }`
**Success response (200):** `data: { "section": { … } }`
**Exceptions:** as API03, plus
| Code | Condition | Response body |
|---|---|---|
| 409 | The type's definition is not hideable (`hero`) | `SECTION_NOT_HIDEABLE` |
### section-engine.API05 — PUT /api/v1/cms/portfolio/section-order
**Request payload:** `{ "expectedRevision": 3, "order": ["work", "about", "experience", "stack", "contact"] }`
**Success response (200):** `data: { "portfolio": { "revision": 4, "sectionOrder": [ … ] } }`
**Exceptions:**
| Code | Condition | Response body |
|---|---|---|
| 400 | `order` is not an exact permutation of the orderable types (missing, duplicate, unknown, or contains `hero`) | `VALIDATION_FAILED` |
| 401 / 403 | As above | — |
| 409 | Portfolio `expectedRevision` is stale | `REVISION_CONFLICT`, `currentRevision` |
### section-engine.API06 — PUT /api/v1/cms/portfolio/slug
**Request payload:** `{ "expectedRevision": 4, "slug": "ghulam" }`
**Success response (200):** `data: { "portfolio": { "id", "slug", "revision": 5, "sectionOrder" } }`
**Exceptions:**
| Code | Condition | Response body |
|---|---|---|
| 400 | `slug` breaks the shape rule | `VALIDATION_FAILED` |
| 401 / 403 | As above | — |
| 409 | Reserved, or used by another portfolio | `SLUG_TAKEN` |
| 409 | Portfolio `expectedRevision` is stale | `REVISION_CONFLICT`, `currentRevision` |
## Acceptance Criteria
1. section-engine.AC1 — Given a seeded portfolio, when API01 is called, then it returns the six
   sections of the catalogue with their data, and `sectionOrder` in stored order.
2. section-engine.AC2 — Given a section at revision *n*, when API03 is called with
   `expectedRevision: n` and a valid payload, then the data is stored, the revision becomes
   *n + 1*, `updatedAt` changes, and no other section's revision changes.
3. section-engine.AC3 — Given a section at revision *n*, when API03 is called with any other
   `expectedRevision`, then the response is 409 with `currentRevision: n` and nothing is written.
4. section-engine.AC4 — Given a payload that violates the type's schema, when API03 is called,
   then the response is 400 listing every failing path, and nothing is written.
5. section-engine.AC5 — Given a `:type` that is not registered, when API03 or API04 is called,
   then the response is 404.
6. section-engine.AC6 — Given a text field containing HTML tags or control characters, when it
   is saved, then the stored value has them stripped (`<b>Hi</b>` → `Hi`); and given stripping
   leaves a required field empty, then the response is 400.
7. section-engine.AC7 — Given a list payload, when an item has no `id`, then the server assigns
   one; when an item has an `id`, then it is preserved; when two items share an `id`, then the
   response is 400.
8. section-engine.AC8 — Given a hideable section, when API04 sets `visible: false`, then API01
   returns it with `visible: false` and its data intact; given `hero`, then the response is 409
   `SECTION_NOT_HIDEABLE`.
9. section-engine.AC9 — Given a valid permutation, when API05 is called, then `sectionOrder` is
   replaced in one atomic write and the portfolio revision increments.
10. section-engine.AC10 — Given a `SectionDefinition` for a new type is registered in the
    registry, when API02 and API03 are exercised for that type, then it is listed and its
    payload is validated and stored — with no change to `SectionService`, its controller, its
    routes or the registry class.
11. section-engine.AC11 — Given two definitions registered under the same type, when the
    container is built, then startup fails naming the duplicate type.
12. section-engine.AC12 — Given an empty database, when the portfolio seeder runs, then one
    portfolio and six sections exist holding the reference content; when it runs again, or runs
    after a section has been edited, then no document is created or overwritten.
13. section-engine.AC13 — Given a list of visible sections, when the page composer in
    `packages/sections` renders them, then `hero` is first, the rest follow `sectionOrder`,
    hidden sections are absent, and the non-hero sections are numbered `01…` consecutively in
    rendered order.
14. section-engine.AC14 — Given section data whose type has no registered renderer, when the
    page composer renders, then that section is skipped, a development-only warning is logged,
    and the rest of the page renders.
15. section-engine.AC15 — Given a user with no portfolio, when they call API01, then one
    portfolio is created for them with a slug from their display name, one section per
    registered type holding that definition's defaults, all visible; a second call creates
    nothing; two parallel first calls leave exactly one portfolio.
16. section-engine.AC16 — Given users A and B with portfolios, when A calls API01 and API03–API06,
    then only A's documents are read or written; B's revisions and data are unchanged.
17. section-engine.AC17 — Given API06 with a valid unused slug and the current revision, then
    the slug is replaced and the revision increments; a reserved or taken slug answers 409
    `SLUG_TAKEN`; a malformed one 400.
18. section-engine.AC18 — Given a registered type with no stored document for this portfolio,
    when API01 is called, then it returns that type with the definition's defaults,
    `visible: false` and `revision: 0`, and the first API03 creates the document. A type that
    cannot be hidden (the hero) is the exception: it is always shown, created, saved and
    published visible (clarified 2026-10-21 with the fix in `memory/pitfalls.md`).
## Edge Cases Covered
- Two browser tabs editing the same section: the second save gets 409, never a silent overwrite.
- Editing section A while section B is saved elsewhere: no conflict (per-section revisions).
- Hiding every hideable section: allowed here; `publish-pipeline` decides if that is publishable.
- A payload with unknown extra keys: stripped, not stored.
- A registered type with no stored document (type added after seeding): API01 returns it with
  the definition's defaults, `visible: false`, `revision: 0`; the first PUT creates it.
## Error Handling
- Validation errors report paths relative to `data` so the editor can attach them to fields.
- Repository conditional-update miss → `ConflictError`; the service re-reads to report
  `currentRevision`.
- A definition whose defaults fail its own schema fails container startup, not a request.
## Unit Test Cases (spec-derived)
| Test ID | Maps to AC | Scenario | Expected |
|---|---|---|---|
| section-engine.UT01 | AC2 | `updateSection` with matching revision (fake repo, fake registry) | Repo called with sanitised data + expected revision; returns revision + 1 |
| section-engine.UT02 | AC3 | Repo reports no match | Throws `REVISION_CONFLICT` carrying the current revision |
| section-engine.UT03 | AC4 | Payload failing the definition's schema | Throws validation error with paths; repo not called |
| section-engine.UT04 | AC5 | Unregistered type | Throws not-found |
| section-engine.UT05 | AC6 | `plainText` on `<b>Hi</b>\u0007` and on `<br>` (required) | `Hi`; validation error |
| section-engine.UT06 | AC7 | Items with missing, existing and duplicate ids | Assigned; preserved; validation error |
| section-engine.UT07 | AC8 | `setVisibility` on a non-hideable definition | Throws `SECTION_NOT_HIDEABLE` |
| section-engine.UT08 | AC9 | `reorder` with missing / duplicate / `hero` / unknown entries | Validation error each |
| section-engine.UT09 | AC10 | Registry with an extra fake definition | Listed by `listTypes`; `updateSection` validates with its schema |
| section-engine.UT10 | AC11 | Register a duplicate type | Throws naming the type |
| section-engine.UT11 | AC13 | Composer with one hidden section | Order correct; numbers consecutive, skipping none |
| section-engine.UT12 | AC14 | Composer with an unknown type | Skipped; others rendered |
| section-engine.UT13 | AC15 | `initialSlug` for names, empties, reserved and taken slugs | Rules of Slug rules |
| section-engine.UT14 | AC15 | Provisioning on an empty fake store, then again | Created once |
| section-engine.UT15 | AC17 | `changeSlug` with reserved, taken, valid | `SLUG_TAKEN`; `SLUG_TAKEN`; stored |
| section-engine.UT16 | AC18 | `readDraft` with a missing section document | Defaults, hidden, revision 0 |
## Explicitly Out of Scope
- Each section's payload schema, editor and renderer — the six section specs.
- Identity and design data — `site-identity`, `design-theme`.
- Publishing, snapshots, "unpublished changes" — `publish-pipeline`.
- More than one instance of a section type; more than one portfolio per user.
- Deleting a portfolio or an account.
- Draft history / undo.
## Non-Functional Constraints (from constitution.md)
- Open/Closed is the acceptance bar: AC10 is tested by adding a type without editing the engine.
- `portfolio` is the only writer of `portfolios` and `sections`.
- No latency target defined yet for CMS routes.
