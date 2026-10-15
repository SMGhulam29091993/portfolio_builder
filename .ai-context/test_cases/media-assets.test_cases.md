# Test Cases: Media Assets
**Spec:** .ai-context/specs/media-assets.spec.md
**Spec-derived unit cases:** UT01–UT08 are defined in the spec and not restated here.

## Integration (real MongoDB + GridFS, real HTTP)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| media-assets.IT01 | AC1 | Upload a real small PDF as `resume`, then GET content | 201; bytes and `sha256` match |
| media-assets.IT02 | AC2 | PNG bytes named `cv.pdf`, header `application/pdf`, kind `resume` | 415; `assets` and `asset_files.files` empty |
| media-assets.IT03 | AC3 | SVG as `image` | 415 |
| media-assets.IT04 | AC4 | 5 MB + 1 byte PDF | 413; no document, no chunks left |
| media-assets.IT05 | AC6 | Same PDF twice | 201 then 200 with the same id; one GridFS file |
| media-assets.IT06 | AC7 | List with `kind=resume`, `kind=image`, none, `kind=zip` | Filtered; filtered; all; 400 |
| media-assets.IT07 | AC8 | Delete an unreferenced asset | 200; metadata and chunks gone; content → 404 |
| media-assets.IT08 | AC9 | Delete with a test provider reporting true | 409 `ASSET_IN_USE` with the provider label; bytes intact |
| media-assets.IT09 | AC10 | Each route with no cookie | 401 |
| media-assets.IT10 | Edge | Zero-byte file | 400 |
| media-assets.IT11 | Edge | Two identical uploads in parallel | One asset; both responses carry its id |
| media-assets.IT12 | Edge | Abort the request mid-upload | No document, no chunks |

## Contract suites
| Test ID | Interface | Asserts |
|---|---|---|
| media-assets.CT01 | `IFileStorage` (GridFS, in-memory) — AC12 | put returns the right size + hash; get streams identical bytes; delete is idempotent; get after delete throws not-found |

## End to end
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| media-assets.E2E01 | AC11 | Upload a PDF, see it listed, delete it | Progress shown; list updates |
| media-assets.E2E02 | AC11 | Upload a too-large file and a wrong-type file | Each shows the limit / allowed types |

## Data variations
- Files exactly at each limit (accepted) and one byte over (rejected).
- Filenames: unicode, spaces, leading dots, no extension, `..\..\x.pdf`.
- Fixture files are generated in the test (minimal valid headers), never real personal documents.
