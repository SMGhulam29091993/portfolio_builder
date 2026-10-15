# Spec: Section Engine
## Spec ID
section-engine
## Status
Draft
## Linked BRD
.ai-context/BRD.md#BRD-001
## Intent
Give the CMS one generic way to read, edit, hide and reorder the portfolio's page sections, and
give the codebase one way to add a section type. Each type plugs a definition (schema, defaults,
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
## API Contract
All routes require the owner session and resolve the owner's portfolio.
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
**Exceptions:** 401 `UNAUTHENTICATED`.
### section-engine.API02 — GET /api/v1/cms/portfolio/section-types
**Success response (200):**
```json
{ "data": { "types": [ { "type": "about", "label": "About",
  "orderable": true, "hideable": true, "inNav": true } ] } }
```
**Exceptions:** 401 `UNAUTHENTICATED`.
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
| 401 | No session | `UNAUTHENTICATED` |
| 403 | `Origin` not allowed | `ORIGIN_NOT_ALLOWED` |
| 404 | `:type` is not registered | `NOT_FOUND` |
| 409 | `expectedRevision` is stale | `REVISION_CONFLICT`, `currentRevision` |
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
## Explicitly Out of Scope
- Each section's payload schema, editor and renderer — the six section specs.
- Identity and design data — `site-identity`, `design-theme`.
- Publishing, snapshots, "unpublished changes" — `publish-pipeline`.
- More than one instance of a section type; more than one portfolio per owner.
- Draft history / undo.
## Non-Functional Constraints (from constitution.md)
- Open/Closed is the acceptance bar: AC10 is tested by adding a type without editing the engine.
- `portfolio` is the only writer of `portfolios` and `sections`.
- No latency target defined yet for CMS routes.
