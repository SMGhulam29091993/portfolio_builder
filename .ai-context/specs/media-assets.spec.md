# Spec: Media Assets
## Spec ID
media-assets
## Status
Implemented
- `In Progress → Implemented` on 2026-10-20: T01–T06 completed, each with a DoD self-check line
  in `state/completed.md`.
- `Ready → In Progress` on 2026-10-20 with `media-assets.T01` started.
- DoR self-check: 2026-10-20, pass. Moved `Draft → Ready` by the agent under the owner's
  standing authorisation of 2026-10-20 (`governance.md`).
- Revised 2026-10-20, before the spec was ever `Ready`, for ADR-0010: every asset belongs to one
  portfolio and is served only to that portfolio's user; another user's id answers 404 on every
  route (AC13); dedupe is per portfolio. Built before `site-identity`, which validates against
  it (build-order swap recorded in `status.md`). Multipart parsing uses `busboy` (pinned in
  ADR-0007).
## Linked BRD
.ai-context/BRD.md#BRD-006
## Intent
Let each signed-in user upload, list and remove the small set of files the portfolio needs — the résumé
PDF behind the nav's `Résumé` button and an optional social-preview image — with the file's real
type and size checked before anything is stored, and with deletion refused while a file is in
use. Bytes are stored behind a storage interface so the backend can change without touching the
rest of the system.
## Context
- Builds on: .ai-context/architecture.md (API modules → `assets`)
- Related: .ai-context/specs/site-identity.spec.md, publish-pipeline.spec.md,
  public-site-rendering.spec.md (public delivery of published files)
- Shared facts used: .ai-context/ownership_index.md (Response envelope · Session contract)
## Asset reference
Canonical owner (`ownership_index.md`).
```json
{ "id": "string", "kind": "resume | image", "filename": "string", "mime": "string",
  "sizeBytes": 55544, "sha256": "hex", "createdAt": "ISO-8601", "inUse": false }
```
| Kind | Accepted types (by content) | Max size |
|---|---|---|
| `resume` | `application/pdf` | 5 MB |
| `image` | `image/png`, `image/jpeg`, `image/webp` | 2 MB |
Other modules store only `assetId`. This module serves bytes only to the signed-in user whose
portfolio owns the asset (ADR-0010); visitors receive published files through
`public-site-rendering.API02`.
## API Contract
### media-assets.API01 — POST /api/v1/cms/assets
**Request payload:** `multipart/form-data` — `kind` (text), `file` (one file).
**Success response (201):** `data: { "asset": AssetReference }`. If an identical file (same
`sha256` and `kind`) already exists, **200** with the existing asset and no second copy.
**Exceptions:**
| Code | Condition | Response body |
|---|---|---|
| 400 | Missing `file`, missing or unknown `kind`, more than one file | `VALIDATION_FAILED` |
| 413 | File exceeds the kind's limit | `PAYLOAD_TOO_LARGE`, `maxBytes` |
| 415 | Detected content type not allowed for the kind (regardless of extension or header) | `UNSUPPORTED_MEDIA_TYPE`, `allowed` |
| 401 / 403 | No session / `Origin` not allowed | — |
### media-assets.API02 — GET /api/v1/cms/assets?kind=
**Success response (200):** `data: { "assets": [AssetReference] }`, newest first. `kind` optional.
**Exceptions:** 400 unknown `kind`; 401.
### media-assets.API03 — DELETE /api/v1/cms/assets/:id
**Success response (200):** `data: { "deleted": true }`
**Exceptions:**
| Code | Condition | Response body |
|---|---|---|
| 404 | Unknown id | `NOT_FOUND` |
| 409 | Referenced by the draft or by any snapshot | `ASSET_IN_USE`, `usedBy: string[]` |
| 401 / 403 | As above | — |
### media-assets.API04 — GET /api/v1/cms/assets/:id/content
**Success response (200):** the file bytes with the stored `Content-Type`,
`X-Content-Type-Options: nosniff`, `Content-Disposition: inline`, `Cache-Control: private, no-store`.
**Exceptions:** 401; 404 `NOT_FOUND`.
## Acceptance Criteria
1. media-assets.AC1 — Given a valid PDF under 5 MB, when API01 is called with `kind=resume`,
   then the response is 201 with the asset reference, and API04 returns the identical bytes.
2. media-assets.AC2 — Given a file named `cv.pdf` and sent as `application/pdf` whose bytes are
   a PNG, when API01 is called with `kind=resume`, then the response is 415 and nothing is
   stored.
3. media-assets.AC3 — Given an SVG, HTML or executable file, when API01 is called with either
   kind, then the response is 415.
4. media-assets.AC4 — Given a file larger than the kind's limit, when API01 is called, then the
   upload is aborted as soon as the limit is crossed, the response is 413, and no metadata or
   partial bytes remain in storage.
5. media-assets.AC5 — Given a filename containing path separators, control characters or more
   than 100 characters, when it is uploaded, then the stored filename is reduced to a safe base
   name with its extension and at most 100 characters.
6. media-assets.AC6 — Given an asset already stored, when the same bytes are uploaded again with
   the same kind, then the response is 200 with the existing asset and storage holds one copy.
7. media-assets.AC7 — Given several assets, when API02 is called with and without `kind`, then
   results are filtered accordingly, newest first, each with a correct `inUse` flag.
8. media-assets.AC8 — Given an asset no provider reports as referenced, when API03 is called,
   then its metadata and bytes are both removed and API04 returns 404.
9. media-assets.AC9 — Given an asset referenced by the draft identity or by any snapshot, when
   API03 is called, then the response is 409 `ASSET_IN_USE` naming where, and nothing is deleted.
10. media-assets.AC10 — Given no session, when API01–API04 are called, then each returns 401 —
    including API04, so an unpublished file is never readable anonymously.
11. media-assets.AC11 — Given `/cms/assets`, when the owner uploads, then progress is shown,
    413 and 415 are explained with the limit or allowed types, the list refreshes, and Delete
    is disabled with a reason for assets in use.
13. media-assets.AC13 — Given an asset of user A, when user B calls API03 or API04 with its id,
    or lists assets, then B gets 404 / does not see it, and A's asset is untouched; an identical
    file uploaded by B is stored as B's own asset.
12. media-assets.AC12 — Given any implementation of `IFileStorage`, when the shared contract
    suite runs against it, then put, get, delete and "get after delete" behave identically.
## Edge Cases Covered
- A zero-byte file → 400.
- Upload interrupted by the client → no orphaned bytes or metadata.
- A delete that removes metadata but fails on bytes: bytes are deleted first; a failure leaves
  the asset intact and returns 500.
- A file referenced only by an old snapshot is still "in use" — rollback must keep working.
- Concurrent identical uploads: the unique index on `{ sha256, kind }` makes one win; the other
  returns the winner.
## Error Handling
- Type detection reads magic bytes from the first chunk; the client's header and the extension
  are never trusted.
- Storage failures → 500 `INTERNAL_ERROR`; partial writes are cleaned up before responding.
- A reference provider that throws fails the delete (fail closed), never treats the asset as
  unused.
## Unit Test Cases (spec-derived)
| Test ID | Maps to AC | Scenario | Expected |
|---|---|---|---|
| media-assets.UT01 | AC2, AC3 | `ContentTypeDetector` on PDF, PNG, JPEG, WebP, SVG, HTML and EXE headers | Correct type or "unknown" |
| media-assets.UT02 | AC2 | `AssetService.upload` — detected PNG with `kind=resume` | Throws unsupported-media-type; storage `put` not completed |
| media-assets.UT03 | AC4 | Stream exceeding the limit | Throws payload-too-large; storage `delete` called for the partial object |
| media-assets.UT04 | AC5 | `sanitizeFilename` on `../../a/b.pdf`, a 300-character name, a name with control characters | Safe base names ≤ 100 |
| media-assets.UT05 | AC6 | Upload with an existing `sha256` + kind | Returns the existing asset; no second `put` retained |
| media-assets.UT06 | AC8 | Delete with all providers reporting false | Storage delete then metadata delete |
| media-assets.UT07 | AC9 | Delete with one provider reporting true | Throws `ASSET_IN_USE` with that provider's label |
| media-assets.UT08 | Edge | A provider throws | Delete fails; nothing removed |
## Explicitly Out of Scope
- Image resizing, optimisation or format conversion.
- Video, audio, fonts, archives.
- Object storage (S3 or similar) and CDN delivery — needs an ADR.
- Virus scanning.
- Serving files to anonymous visitors — `public-site-rendering.API02`.
## Non-Functional Constraints (from constitution.md)
- Uploads: content-sniffed type, size capped before buffering, SVG rejected.
- Files are stored in MongoDB (GridFS) only; no object store or other datastore is added.
- Filenames and file contents are never logged.
