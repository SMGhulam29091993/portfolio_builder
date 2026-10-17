# Test Cases: Monorepo Foundation
**Spec:** .ai-context/specs/monorepo-foundation.spec.md
**Spec-derived unit cases:** UT01–UT07 are defined in the spec and not restated here.

## Unit (added during implementation)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| monorepo-foundation.UT08 | AC12 | Web `loadEnv` with `API_INTERNAL_URL` absent, malformed, or a non-HTTP URL carrying credentials | Throws naming the variable; no value in the message or error |
| monorepo-foundation.UT09 | AC12 | `createApiRewrites` with a plain base URL and one with a path prefix and trailing slashes | `/api/v1/:path*` → same path on the base; prefix kept, no `//` |
| monorepo-foundation.UT10 | Plan (`IEventBus`) | Publish to two handlers | Both receive the frozen event (name, payload, meta, `occurredAt`) in subscription order |
| monorepo-foundation.UT11 | Plan (`IEventBus`) | First handler throws | `publish` resolves; the error is logged with event, handler and request id, not the payload; the second handler still runs |
| monorepo-foundation.UT12 | Plan (`IEventBus`) | Unsubscribe, then publish two event names | The removed handler is not called; the other event's handler is |
| monorepo-foundation.UT13 | Plan (test harness) | `FixtureFactory` build, override, `buildList` | Sequence numbers 1, 2…; overrides applied; no shared objects between fixtures |
| monorepo-foundation.UT14 | AC12 (T10) | `apps/api/.env.example` against `architecture.md` → Environment and `config/env.ts` | Lists exactly the API rows, once each; uncommented lines equal the keys `loadEnv` returns and pass it |
| monorepo-foundation.UT15 | AC12 (T10) | `apps/web/.env.example` against `architecture.md` → Environment and `lib/env.ts` | Lists exactly the web rows, once each; uncommented lines equal the keys `loadEnv` returns and pass it |

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
| monorepo-foundation.IT13 | AC1 | Run the Turborepo pipeline twice | Second run fully cached — CI step `scripts/check-turbo-cache.mjs` |
| monorepo-foundation.IT14 | AC9 | Architecture test over the real `apps/api/src` | No undeclared edge, no module missing from the map, and the map's module list equals `architecture.md` → API modules |
| monorepo-foundation.IT15 | AC9 | Cycle check over the real module graph (constitution: a DAG) | No cycle; a fixture cycle is reported by its path |
| monorepo-foundation.IT16 | Plan (test harness) | `MongoTestHarness` start and `reset()` | Singleton connected to a real `mongod`; collections emptied, indexes kept |

## End to end
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| monorepo-foundation.E2E01 | AC12 | Fetch `/api/v1/health` from the web origin | 200 through the rewrite |

## Data variations
- Env: each required variable removed in turn; a non-numeric `PORT`; an invalid `MONGODB_URI` scheme.
- Log capture for UT01 / IT03 asserts that no secret value appears in output.
