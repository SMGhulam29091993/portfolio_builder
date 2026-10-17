# Spec: Monorepo Foundation
## Spec ID
monorepo-foundation
## Status
Implemented
- Draft → Ready — owner, 2026-10-15 (ADR-0007 accepted the same day)
- DoR self-check: 2026-10-15, pass
- Ready → In Progress — 2026-10-15, `monorepo-foundation.T01` marked `inprogress`
- In Progress → Implemented — 2026-10-17, T01–T10 `completed`, each with a DoD self-check line
  in `state/completed.md`
## Linked BRD
.ai-context/BRD.md#BRD-007
## Intent
Stand up the Turborepo with `apps/api`, `apps/web` and the shared packages, and give the API
its one way of doing each cross-cutting thing — validated configuration, a fail-fast startup
sequence, a composition root, the response envelope, validation and error middleware, security
middleware, a health endpoint, an OpenAPI document, and lint rules that make the module
boundaries in `constitution.md` mechanically enforced. Every later feature builds on these and
adds no second way.
## Context
- Builds on: .ai-context/architecture.md (Repository layout, Request lifecycle, Environment)
- Related: .ai-context/decisions/ADR-0002-root-context-in-turborepo.md, ADR-0007-tooling-baseline.md
- Shared facts used: .ai-context/ownership_index.md (Response envelope and canonical error codes ·
  Layer rules, SOLID enforcement, approved LLD patterns · Environment variables)
## API Contract
### monorepo-foundation.API01 — GET /api/v1/health
**Auth:** none
**Request payload:** none
**Success response (200):**
```json
{ "success": true, "message": "ok",
  "data": { "status": "ok", "db": "up", "version": "string", "uptimeSec": "number" } }
```
**Exceptions:**
| Code | Condition | Response body |
|---|---|---|
| 503 | MongoDB ping fails or times out | `SERVICE_UNAVAILABLE`, `data.db = "down"` |
| 429 | Rate limit exceeded | `RATE_LIMITED` |
## Acceptance Criteria
1. monorepo-foundation.AC1 — Given a clean clone, when `pnpm install` then
   `pnpm turbo run build typecheck lint test` run, then every workspace passes, and an immediate
   second run of the same command is served entirely from the Turborepo cache.
2. monorepo-foundation.AC2 — Given a required environment variable is missing or malformed, when
   the API starts, then it logs the variable's **name** (never a value) and exits with code 1
   before opening a port.
3. monorepo-foundation.AC3 — Given MongoDB is unreachable, when the API starts, then it exits
   with code 1 without opening a port.
4. monorepo-foundation.AC4 — Given the API is running with MongoDB reachable, when
   `GET /api/v1/health` is called, then it returns 200 with the body in API01.
5. monorepo-foundation.AC5 — Given the API is running and MongoDB then becomes unreachable, when
   `GET /api/v1/health` is called, then it returns 503 `SERVICE_UNAVAILABLE` with `db: "down"`.
6. monorepo-foundation.AC6 — Given any unmatched path under `/api/v1`, when it is requested,
   then the response is 404 `NOT_FOUND` in the standard envelope.
7. monorepo-foundation.AC7 — Given a handler throws an error that is not an `AppError`, when the
   request completes, then the response is 500 `INTERNAL_ERROR` containing no stack trace or
   driver message, and the original error is logged with the request id.
8. monorepo-foundation.AC8 — Given a route guarded by `validate(schema)`, when the body fails
   the schema, then the response is 400 `VALIDATION_FAILED` listing each failing path, and the
   controller method is never invoked.
9. monorepo-foundation.AC9 — Given source that (a) imports another module's non-`index` file,
   (b) imports `mongoose` or `express` in a `*.service.ts`, (c) reads `process.env` outside
   `config/env.ts`, or (d) instantiates a service, repository, adapter or controller outside
   `container.ts` or a test file, when lint runs, then it fails naming the rule.
10. monorepo-foundation.AC10 — Given a route is mounted but missing from
    `apps/api/openapi/openapi.yaml`, or documented but not mounted, when the drift check runs,
    then it fails naming the path and method.
11. monorepo-foundation.AC11 — Given a client exceeds the configured request rate on a
    rate-limited mount, when it sends another request, then the response is 429 `RATE_LIMITED`
    with a `Retry-After` header.
12. monorepo-foundation.AC12 — Given `pnpm dev`, when the web origin is asked for
    `/api/v1/health`, then the request is proxied to the API and returns 200.
13. monorepo-foundation.AC13 — Given the API receives `SIGTERM`, when shutdown runs, then it
    stops accepting connections, lets in-flight requests finish, closes the MongoDB connection
    and exits with code 0.
## Edge Cases Covered
- Hot reload in development reuses the cached MongoDB connection; production does not cache.
- Malformed JSON body → 400 `VALIDATION_FAILED`, not 500.
- Body above the JSON limit → 413 `PAYLOAD_TOO_LARGE`.
- `NODE_ENV=production` with a development-only setting present (stub AI provider) fails
  startup — the rule itself is owned by `ai-design-studio`; the env validator is the mechanism.
- The rate limiter keeps counters in process memory; it resets on restart and is per-instance.
## Error Handling
- Startup failures (env, DB) → log, `process.exit(1)`; never serve traffic half-configured.
- `AppError` subclasses → mapped by the single error middleware to the canonical codes.
- Unknown errors → 500 `INTERNAL_ERROR`; details only in logs.
- Health check DB ping has its own short timeout so the endpoint cannot hang.
## Unit Test Cases (spec-derived)
| Test ID | Maps to AC | Scenario | Expected |
|---|---|---|---|
| monorepo-foundation.UT01 | AC2 | Parse env with `MONGODB_URI` absent | Throws; message names the variable, contains no values |
| monorepo-foundation.UT02 | AC2 | Parse a complete valid env | Returns a frozen typed object |
| monorepo-foundation.UT03 | AC7 | Error middleware given a plain `Error` | 500 `INTERNAL_ERROR`, no `stack` in body |
| monorepo-foundation.UT04 | AC7 | Error middleware given `ConflictError('REVISION_CONFLICT')` | 409 with that code |
| monorepo-foundation.UT05 | AC8 | `validate` with a failing body | 400 with `errors[].path`; `next` handler not called |
| monorepo-foundation.UT06 | AC8 | `validate` with a passing body | `req.validatedBody` holds the parsed value |
| monorepo-foundation.UT07 | AC4, AC5 | `HealthService` with a fake DB probe up / down | `db: "up"` / throws service-unavailable |
## Explicitly Out of Scope
- Hosting, deployment pipelines, production container images.
- Any feature module other than `health`.
- A distributed rate-limit store (Redis is not an approved datastore).
- Metrics, tracing, log shipping.
## Non-Functional Constraints (from constitution.md)
- `GET /api/v1/health` responds within 200 ms at p95.
- TypeScript `strict` in every workspace; no `any` without a commented reason.
- Coverage floor wired into CI from the first commit, even though it starts with one service.
