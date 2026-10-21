# Spec: Publish Pipeline
## Spec ID
publish-pipeline
## Status
Implemented
- `In Progress → Implemented` on 2026-10-21: T01–T09 completed, each with a DoD self-check line in
  `state/completed.md`; E2E01–E2E03 pass in the browser.
- `Ready → In Progress` on 2026-10-21 with `publish-pipeline.T01` started.
- DoR self-check: 2026-10-21, pass. Moved `Draft → Ready` by the agent under the owner's
  standing authorisation of 2026-10-20 (`governance.md`); ADR-0004 accepted (with retention),
  ADR-0013 accepted.
- Revised 2026-10-21, before the spec was ever `Ready`: (1) ADR-0010 — every snapshot, pointer
  and route belongs to the signed-in user's portfolio; `portfolio.published` carries the
  portfolio's slug so the site revalidates that page only; (2) ADR-0004 retention — after a
  successful pointer switch, snapshots older than the newest 20 of that portfolio are deleted,
  except the live one; a pruning failure is logged and never fails the publish (AC20); the
  snapshot repository gains that one delete, scoped to non-live, out-of-window versions;
  (3) ADR-0013 — `publishing` owns `IDraftContributor`, `IPublishedPointerWriter`,
  `IPublishedPointerReader` and `IPublishDesignCheck` (used by `design-valid`) and imports
  neither `portfolio` nor `design`; (4) `no-placeholder-text` also blocks template placeholders
  (`[Your …]`, `section-engine` → Portfolio provisioning) through the shared
  `PLACEHOLDER_PATTERN` in `packages/contracts`, so an untouched new portfolio cannot publish
  (AC21).
## Linked BRD
.ai-context/BRD.md#BRD-005
## Intent
Turn the draft into what visitors see, deliberately and reversibly. Publishing checks the whole
draft against a set of rules, freezes it into an immutable, versioned snapshot, switches the
live pointer to it in one atomic step, and tells the site to refresh. The owner can see what
would block a publish before trying, see the history, and switch back to any earlier version.
The draft is never what visitors read.
## Context
- Builds on: .ai-context/architecture.md (Draft → publish → site, Module dependency map)
- Related: .ai-context/decisions/ADR-0004-snapshot-publishing.md; .ai-context/specs/section-engine.spec.md,
  site-identity.spec.md, design-theme.spec.md, media-assets.spec.md, public-site-rendering.spec.md
- Shared facts used: .ai-context/ownership_index.md (Session contract · Identity payload ·
  DesignSpec · Asset reference · Section type catalogue)
## Published content
Canonical owner (`ownership_index.md`). Stored as `snapshots.content`.
```json
{ "schemaVersion": 1,
  "identity": "Identity",
  "sections": [ { "type": "hero", "data": { } } ],
  "design": { "theme": { }, "layout": { } },
  "assets": [ { "id": "string", "kind": "resume | image", "filename": "string",
                "mime": "string", "sizeBytes": 0, "sha256": "hex" } ] }
```
`sections` holds **visible sections only**, in render order (`hero` first). `assets` lists every
asset referenced anywhere in the content. `contentHash` is the SHA-256 of the canonical JSON
(keys sorted, no insignificant whitespace). The content and its hash never change after insert;
only the snapshot's `delivery` record (revalidation attempts) is updated later.
## Publish rules
Canonical owner. Each is one `IPublishRule` class.
| Rule id | Severity | Fails when |
|---|---|---|
| `no-placeholder-text` | error | Any string in the content matches `PLACEHOLDER_PATTERN` (`packages/contracts`): a bracketed upper-case instruction `\[[A-Z0-9][A-Z0-9 ,.'’:;!?/-]{7,}\]`, or a template placeholder `[Your …]` (AC21) |
| `links-valid` | error | Any stored URL does not parse, or is not `https:` / `mailto:` |
| `internal-links-resolve` | error | A `LinkTarget` of kind `section` points at a section that is hidden or absent |
| `assets-resolve` | error | A referenced asset does not exist or has the wrong kind |
| `design-valid` | error | The design fails `IDesignValidator` (schema, catalogue, contrast) or lacks a variant for a visible section |
| `filler-text` | warning | Any string contains `lorem ipsum`, or `TODO` / `TBD` as a whole word (case-insensitive) |
| `resume-missing` | warning | `identity.resume.assetId` is null — the nav will show no résumé button |
| `seo-incomplete` | warning | `identity.seo.title` or `description` is empty |
| `sections-all-hidden` | warning | Only `hero` is visible |
An issue is `{ "rule", "severity", "path", "message" }`, with `path` such as
`sections.work.projects[3].description`.
## API Contract
### publish-pipeline.API01 — GET /api/v1/cms/publishing/status
**Success response (200):**
```json
{ "data": { "published": { "version": 3, "publishedAt": "ISO-8601", "contentHash": "hex" },
            "draft": { "contentHash": "hex" }, "hasUnpublishedChanges": true,
            "revalidation": { "status": "ok | failed | pending", "at": "ISO-8601" } } }
```
`published` and `revalidation` are `null` before the first publish.
**Exceptions:** 401 `UNAUTHENTICATED` / `SESSION_EXPIRED` (the guard — `owner-auth` → Request authorization).
### publish-pipeline.API02 — POST /api/v1/cms/publishing/validate
**Request payload:** none.
**Success response (200):** `data: { "publishable": false, "draftContentHash": "hex", "issues": [Issue] }`
**Exceptions:** 401 / 403.
### publish-pipeline.API03 — POST /api/v1/cms/publishing/publish
**Request payload:** `{ "expectedDraftHash": "hex", "note": "PlainText(200), optional" }`
**Success response (201):**
```json
{ "data": { "snapshot": { "version": 4, "publishedAt": "ISO-8601", "contentHash": "hex" },
            "warnings": [Issue], "revalidation": "ok | failed" } }
```
**Exceptions:**
| Code | Condition | Response body |
|---|---|---|
| 400 | Body fails the schema | `VALIDATION_FAILED` |
| 401 / 403 | No session / `Origin` not allowed | — |
| 409 | The draft's current hash differs from `expectedDraftHash` | `DRAFT_CHANGED`, `draftContentHash` |
| 409 | The draft hash equals the current snapshot's hash | `NOTHING_TO_PUBLISH` |
| 409 | Another publish or activation switched the pointer first | `PUBLISH_CONFLICT` |
| 422 | At least one `error` issue | `PUBLISH_BLOCKED`, `issues` |
### publish-pipeline.API04 — GET /api/v1/cms/publishing/snapshots?limit=&cursor=
**Success response (200):** `data: { "snapshots": [ { "version", "publishedAt", "note",
"contentHash", "isCurrent", "revalidation" } ], "nextCursor": "string | null" }`, newest first;
`limit` 1..50, default 20. Content is not included.
**Exceptions:** 400 bad `limit` / `cursor`; 401.
### publish-pipeline.API05 — POST /api/v1/cms/publishing/snapshots/:version/activate
**Request payload:** none.
**Success response (200):** `data: { "snapshot": { "version", "contentHash" }, "revalidation": "ok | failed" }`
**Exceptions:**
| Code | Condition | Response body |
|---|---|---|
| 404 | No snapshot with that version | `NOT_FOUND` |
| 409 | That version is already current | `ALREADY_CURRENT` |
| 409 | The pointer changed concurrently | `PUBLISH_CONFLICT` |
| 401 / 403 | As above | — |
### publish-pipeline.API06 — POST /api/v1/cms/publishing/revalidate
**Request payload:** none.
**Success response (200):** `data: { "revalidation": "ok | failed" }`
**Exceptions:** 401 / 403; 409 `NOTHING_PUBLISHED` when there is no current snapshot.
## Acceptance Criteria
1. publish-pipeline.AC1 — Given nothing has been published, when API01 is called, then
   `published` is `null` and `hasUnpublishedChanges` is `true`.
2. publish-pipeline.AC2 — Given any draft, when API02 is called, then it returns every issue
   from every rule and the draft's hash, and writes nothing.
3. publish-pipeline.AC3 — Given a draft with no `error` issues and a matching
   `expectedDraftHash`, when API03 is called, then a snapshot with the next version number is
   inserted, the published pointer switches to it, the response is 201, and API01 then reports
   `hasUnpublishedChanges: false`.
4. publish-pipeline.AC4 — Given any content string contains a bracketed upper-case placeholder —
   in particular the seeded Second Brain description
   `[ADD A ONE-LINE DESCRIPTION OF WHAT SECOND BRAIN DOES]` — when API03 is called, then the
   response is 422 `PUBLISH_BLOCKED` with a `no-placeholder-text` issue whose `path` locates the
   field, no snapshot is created and the live site is unchanged. A first publish of the
   untouched seed content therefore fails with exactly this issue.
5. publish-pipeline.AC5 — Given a draft violating any one `error` rule in the rules table, when
   API03 is called, then the response is 422 listing that rule's issue; given several are
   violated, then all are listed in one response.
6. publish-pipeline.AC6 — Given a draft with only `warning` issues, when API03 is called, then
   it publishes and returns the warnings.
7. publish-pipeline.AC7 — Given the draft changed after the owner last validated, when API03 is
   called with the old `expectedDraftHash`, then the response is 409 `DRAFT_CHANGED` and nothing
   is published.
8. publish-pipeline.AC8 — Given the draft is identical to the current snapshot, when API03 is
   called, then the response is 409 `NOTHING_TO_PUBLISH`.
9. publish-pipeline.AC9 — Given hidden sections and a custom order, when a snapshot is built,
   then `sections` contains only visible sections, `hero` first and the rest in `sectionOrder`,
   and `assets` lists exactly the assets the content references.
10. publish-pipeline.AC10 — Given two drafts with the same content, when their hashes are
    computed, then they are equal regardless of key order or the order contributors ran in; and
    given any single value differs, then the hashes differ.
11. publish-pipeline.AC11 — Given a published portfolio, when any draft document is edited, then
    API01 reports `hasUnpublishedChanges: true` and the published content is byte-for-byte
    unchanged.
12. publish-pipeline.AC12 — Given a successful pointer switch, when the `portfolio.published`
    event is handled, then the web app's revalidate route is called with the shared secret and
    the outcome is recorded on the snapshot; and given that call fails or times out, then the
    publish still returns 201 with `revalidation: "failed"`, and API06 can retry it.
13. publish-pipeline.AC13 — Given versions 1–3 with 3 current, when API05 activates version 1,
    then the pointer switches to version 1, the event is emitted, no snapshot document's content
    changes, no new snapshot is created, and no draft document changes.
14. publish-pipeline.AC14 — Given the snapshot repository interface, when it is inspected, then
    it offers insert, reads, the delivery-record update and the retention prune only — no method
    can modify `content`, `contentHash` or `version`, and the only delete (AC20) can never remove
    the live snapshot or one of the newest 20.
15. publish-pipeline.AC15 — Given the snapshot insert succeeds and the pointer switch then
    fails, when the request ends, then it returns an error, the live site still serves the
    previous snapshot, and a retried publish succeeds with a new version.
16. publish-pipeline.AC16 — Given two publish requests race, when both pass validation, then
    version numbers stay unique, exactly one switches the pointer, and the other returns 409
    `PUBLISH_CONFLICT`.
17. publish-pipeline.AC17 — Given a new `IPublishRule` class is registered, when API02 runs,
    then its issues appear — with no change to the pipeline, the service or other rules.
18. publish-pipeline.AC18 — Given an asset referenced by any snapshot, when the `assets` module
    asks its reference providers, then publishing reports it as in use.
19. publish-pipeline.AC19 — Given `/cms/publish`, when it opens, then it shows the status, the
    validation issues grouped by severity with each linked to the screen that fixes it, a
    Publish button disabled while errors exist, a confirmation step with an optional note, and
    the history with a confirmed "Make live" action per older version.
20. publish-pipeline.AC20 — Given 21 snapshots and a new publish, when the pointer has switched,
    then the oldest snapshot is deleted unless it is live; with the live one outside the newest
    20 it is kept; a failing prune is logged and the publish still answers 201.
21. publish-pipeline.AC21 — Given a portfolio still holding any template placeholder (`[Your …]`)
    in a section or the identity, when API03 is called, then the response is 422 with a
    `no-placeholder-text` issue at that path.
## Edge Cases Covered
- A placeholder inside a list item, a tag, a metric label or identity text is found — the rule
  walks every string in the content, not a field list.
- Ordinary bracketed text such as `[1]` or `[beta]` does not trip the placeholder rule (too
  short or not upper-case); `[ADD LINK]` does.
- `WEB_REVALIDATE_URL` unset outside production: the revalidation client is a no-op that reports
  `ok`. In production an unset value fails startup.
- A rule that throws is reported as an `error` issue named after the rule and blocks the
  publish — a broken rule never silently passes.
- Activating a snapshot whose `schemaVersion` is older than the current one is allowed; the
  site must render it (`public-site-rendering.AC16`).
## Error Handling
- Validation runs before anything is written; a blocked publish has no side effects.
- Insert-then-switch ordering makes a mid-publish crash harmless (AC15).
- Revalidation failure is recorded, surfaced in status and never rolls a publish back.
- Event listeners run after the response path's writes; a throwing listener is logged with the
  request id and cannot fail the publish.
## Unit Test Cases (spec-derived)
| Test ID | Maps to AC | Scenario | Expected |
|---|---|---|---|
| publish-pipeline.UT01 | AC4 | `NoPlaceholderTextRule` on the seed work section | One issue at `sections.work.projects[3].description` |
| publish-pipeline.UT02 | AC4 | Same rule on `[1]`, `[beta]`, `[ADD LINK]`, a placeholder inside a tag | Pass; pass; fail; fail |
| publish-pipeline.UT03 | AC5 | Each `error` rule with one passing and one failing fixture | Pass / one issue with the right rule id and path |
| publish-pipeline.UT04 | AC6 | Each `warning` rule with a failing fixture | Issue with `severity: "warning"` |
| publish-pipeline.UT05 | AC9 | `SnapshotBuilder` with one hidden section and a custom order | Hidden absent; order correct; asset list exact |
| publish-pipeline.UT06 | AC10 | Canonical hash of the same content with shuffled keys; then one changed value | Equal; different |
| publish-pipeline.UT07 | AC3 | `PublishPipeline` with fake steps | Steps run in order; context passed through |
| publish-pipeline.UT08 | AC5 | Pipeline where the validate step yields an error issue | Later steps never run |
| publish-pipeline.UT09 | AC7, AC8 | `PublishingService.publish` with a stale hash; with a hash equal to current | `DRAFT_CHANGED`; `NOTHING_TO_PUBLISH` |
| publish-pipeline.UT10 | AC12 | `SiteRevalidationListener` with a succeeding and a throwing client | Delivery recorded `ok` / `failed`; no throw |
| publish-pipeline.UT11 | AC15 | Activate step throws after persist | Error propagates; event not emitted |
| publish-pipeline.UT12 | AC17 | Registry with an extra fake rule | Its issue appears in validation |
| publish-pipeline.UT13 | Edge | A rule that throws | Reported as an error issue; publish blocked |
## Explicitly Out of Scope
- Scheduled publishing; publishing part of a draft.
- Restoring an old snapshot back into the draft (BRD-005, open).
- Diffing two versions.
- A multi-step approval flow — there are no reviewers (ADR-0001).
- Rendering the published content — `public-site-rendering`.
## Non-Functional Constraints (from constitution.md)
- Draft isolation: only this module produces what `/api/v1/public` can read.
- No multi-document transaction; the pointer switch is the commit.
- Test-first: every endpoint and every rule (one passing, one failing fixture each).
