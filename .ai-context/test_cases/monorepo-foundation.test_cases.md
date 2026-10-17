# Test Cases: Monorepo Foundation
**Spec:** .ai-context/specs/monorepo-foundation.spec.md
**Spec-derived unit cases:** UT01–UT07 are defined in the spec and not restated here.

## Integration (real MongoDB, real HTTP)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| monorepo-foundation.IT01 | AC4 | `GET /api/v1/health` with the harness DB up | 200, `db: "up"`, envelope shape |
| monorepo-foundation.IT02 | AC5 | Stop the harness DB, then `GET /health` | 503 `SERVICE_UNAVAILABLE` within the probe timeout |
| monorepo-foundation.IT03 | AC3 | Start `main` with an unreachable `MONGODB_URI` | Process exits 1; port never bound |
| monorepo-foundation.IT04 | AC6 | `GET /api/v1/does-not-exist` | 404 `NOT_FOUND` |
| monorepo-foundation.IT05 | AC7 | Test-only route that throws `new Error('boom')` | 500 `INTERNAL_ERROR`; body has no `boom`, no stack |
| monorepo-foundation.IT06 | AC11 | Exceed the limit on `/health` | 429 with `Retry-After`; next window succeeds |
| monorepo-foundation.IT07 | AC13 | Send `SIGTERM` during an in-flight request | Request completes; process exits 0 |
| monorepo-foundation.IT08 | Edge | POST malformed JSON to a JSON route | 400 `VALIDATION_FAILED` |
| monorepo-foundation.IT09 | Edge | POST a body above the JSON limit | 413 `PAYLOAD_TOO_LARGE` |

## Tooling checks (run in CI as tests)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| monorepo-foundation.IT10 | AC9 | Lint the fixture files in `apps/api/test-fixtures/boundary-lint/` (one per violation) through the API's real config | Four failures, each naming its rule; the legal and exempt fixtures produce none |
| monorepo-foundation.IT11 | AC9 | Architecture test with an undeclared module edge in a fixture | Fails naming the edge |
| monorepo-foundation.IT12 | AC10 | Drift check with a route removed from the document | Fails naming path + method |
| monorepo-foundation.IT13 | AC1 | Run the Turborepo pipeline twice | Second run fully cached |
| monorepo-foundation.IT14 | AC9 | Architecture test over the real `apps/api/src` | No undeclared edge, no module missing from the map, and the map's module list equals `architecture.md` → API modules |
| monorepo-foundation.IT15 | AC9 | Cycle check over the real module graph (constitution: a DAG) | No cycle; a fixture cycle is reported by its path |

## End to end
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| monorepo-foundation.E2E01 | AC12 | Fetch `/api/v1/health` from the web origin | 200 through the rewrite |

## Data variations
- Env: each required variable removed in turn; a non-numeric `PORT`; an invalid `MONGODB_URI` scheme.
- Log capture for UT01 / IT03 asserts that no secret value appears in output.
