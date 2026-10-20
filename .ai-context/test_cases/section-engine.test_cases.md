# Test Cases: Section Engine
**Spec:** .ai-context/specs/section-engine.spec.md
**Spec-derived unit cases:** UT01–UT12 are defined in the spec and not restated here.
All integration cases register a test-only `fake` section definition so the engine is tested
independently of the six real section types.

## Integration (real MongoDB, real HTTP)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| section-engine.IT01 | AC1 | `GET /cms/portfolio` after seeding | All registered types present; order as stored |
| section-engine.IT02 | AC2 | PUT a valid payload | 200; revision + 1; sibling section revisions unchanged in the DB |
| section-engine.IT03 | AC3 | Two PUTs with the same `expectedRevision` | First 200, second 409 with `currentRevision`; DB holds the first payload |
| section-engine.IT04 | AC3 | Two concurrent PUTs (`Promise.all`) | Exactly one 200 and one 409 |
| section-engine.IT05 | AC4 | Invalid payload | 400; paths relative to `data`; DB unchanged |
| section-engine.IT06 | AC5 | PUT `/sections/nope` | 404 |
| section-engine.IT07 | AC6 | Text with `<script>` and a tab character | Stored stripped |
| section-engine.IT08 | AC8 | Hide then show a hideable section | Data intact both times |
| section-engine.IT09 | AC8 | Hide `hero` | 409 `SECTION_NOT_HIDEABLE` |
| section-engine.IT10 | AC9 | Reorder; then reorder with a stale revision | 200; 409 |
| section-engine.IT11 | AC12 | Seed twice; edit a section; seed again | Counts unchanged; edit preserved |
| section-engine.IT12 | Auth | Every route with no cookie | 401 |
| section-engine.IT13 | Edge | Register a type after seeding, call API01 | Returned with defaults, `revision: 0`, `visible: false`; first PUT creates it |
| section-engine.IT14 | Edge | Payload with unknown extra keys | 200; extra keys absent from the DB |
| section-engine.IT15 | AC15 | First API01 for a new user; then again; then two in parallel for another user | One portfolio each, all types provisioned visible, slug from display name |
| section-engine.IT16 | AC16 | Users A and B; A edits, hides, reorders, renames slug | B's documents byte-for-byte unchanged |
| section-engine.IT17 | AC17 | Slug: valid, reserved, taken, malformed, stale revision | 200; 409 `SLUG_TAKEN`; 409; 400; 409 `REVISION_CONFLICT` |

## Contract suites
| Test ID | Interface | Asserts |
|---|---|---|
| section-engine.CT01 | `ISectionDefinition` | Run against every registered definition: `defaults()` satisfies `schema`; flags are booleans; type is unique |
| section-engine.CT02 | `ISectionRepository` | Conditional update semantics identical for the Mongo implementation and the in-memory fake |

## Component
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| section-engine.UT17 | AC13 | Composer with all hideable sections hidden | Only hero rendered; no numbering artefacts |

## Data variations
- Strings at exactly the limit, one over, empty, whitespace only, emoji, right-to-left text.
- `order` arrays: empty, reversed, with one extra unknown type.
