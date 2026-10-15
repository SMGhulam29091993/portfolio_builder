# Test Cases: Publish Pipeline
**Spec:** .ai-context/specs/publish-pipeline.spec.md
**Spec-derived unit cases:** UT01–UT13 are defined in the spec and not restated here.

## Integration (real MongoDB, real HTTP, all content modules wired)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| publish-pipeline.IT01 | AC1 | Status on a freshly seeded database | `published: null`, `hasUnpublishedChanges: true` |
| publish-pipeline.IT02 | AC4 | Publish the untouched seed | 422 with exactly one `error`: `no-placeholder-text` at the Second Brain description; `snapshots` empty |
| publish-pipeline.IT03 | AC3 | Replace the placeholder, validate, publish | 201, version 1; pointer set; status clean |
| publish-pipeline.IT04 | AC7 | Validate, edit a section, publish with the old hash | 409 `DRAFT_CHANGED`; no new snapshot |
| publish-pipeline.IT05 | AC8 | Publish twice with no edit between | Second → 409 `NOTHING_TO_PUBLISH` |
| publish-pipeline.IT06 | AC11 | Publish, edit the draft, read the snapshot | Snapshot content unchanged; status dirty |
| publish-pipeline.IT07 | AC9 | Hide `stack`, reorder, publish | Snapshot sections exclude `stack`, follow the new order |
| publish-pipeline.IT08 | AC5 | Draft with a hidden CTA target and a missing asset | 422 listing both rules |
| publish-pipeline.IT09 | AC6 | Draft with no résumé and empty SEO | 201 with two warnings |
| publish-pipeline.IT10 | AC12 | Publish with a revalidation stub returning 200, then 500 | `ok`; `failed` with 201 still returned; API06 then `ok` |
| publish-pipeline.IT11 | AC13 | Three publishes, activate version 1 | Pointer → v1; three snapshots, contents unchanged; draft unchanged |
| publish-pipeline.IT12 | AC13 | Activate the current version; activate version 99 | 409 `ALREADY_CURRENT`; 404 |
| publish-pipeline.IT13 | AC16 | Two publishes in parallel | One 201, one 409 `PUBLISH_CONFLICT`; versions unique |
| publish-pipeline.IT14 | AC15 | Inject a failing pointer writer once | 500; public content unchanged; retry → 201 |
| publish-pipeline.IT15 | AC18 | Publish with a résumé, then delete that asset | 409 `ASSET_IN_USE` naming published snapshots |
| publish-pipeline.IT16 | Auth | Each route with no cookie | 401 |
| publish-pipeline.IT17 | Edge | Start in production mode without `WEB_REVALIDATE_URL` | Startup fails naming the variable |
| publish-pipeline.IT18 | Edge | Development mode without `WEB_REVALIDATE_URL` | Publish → `revalidation: "ok"`; no HTTP call made |
| publish-pipeline.IT19 | AC2 | Call validate on a draft with errors; compare every collection before and after | Issues and draft hash returned; no document created or changed |
| publish-pipeline.IT20 | AC14 | Enumerate `ISnapshotRepository` members; attempt to change `content` through `updateDelivery` | Only insert / read / update-delivery exist; content, hash and version are unchanged in the DB |

## Contract suites
| Test ID | Interface | Asserts |
|---|---|---|
| publish-pipeline.CT01 | `IDraftContributor` (sections, identity, design) | `collect` returns schema-valid output; never returns hidden-section data marked visible; is read-only |
| publish-pipeline.CT02 | `IPublishRule` (all nine) | Returns an array; issues carry the rule's own id and severity; a clean fixture yields none |
| publish-pipeline.CT03 | `IRevalidationClient` (HTTP, no-op) | Resolves to `ok` / `failed`; never throws; HTTP sends the secret header |

## End to end
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| publish-pipeline.E2E01 | AC19 | Open Publish on the seed | Error listed; its link opens the work editor; Publish disabled |
| publish-pipeline.E2E02 | AC19 | Fix it, publish with a note | Confirmation; history shows version 1 as live |
| publish-pipeline.E2E03 | AC19 | Publish again, then "Make live" on version 1 | Confirmation required; version 1 marked live |

## Data variations
- Placeholder rule: brackets in every string-bearing field type; lower-case, mixed-case, short
  and nested brackets.
- Hashing: unicode strings, empty arrays vs missing optional keys, number vs numeric string.
