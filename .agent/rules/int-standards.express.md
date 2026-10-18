# Express + TypeScript Coding Standards

**Applies to:** `apps/api/**`. Conventions only — the hard constraints (layers, SOLID, module
boundaries, approved patterns) are in `constitution.md` and are not repeated here.

## Adding a feature
1. Contract schemas in `packages/contracts/src/<area>/` (zod) — request, response, payload types
2. Repository class — `modules/<name>/<name>.repository.ts`, implementing its interface
3. Service class — `modules/<name>/<name>.service.ts`, implementing its interface
4. Controller class — `modules/<name>/<name>.controller.ts`
5. Router factory — `modules/<name>/<name>.routes.ts`, receives the controller and middleware
   and returns an `ApiRouter` (`core/http`). Register every route with `.route(method, path,
   ...handlers)`, never `router.get()` directly, so the OpenAPI drift check sees it
6. Wire into `src/container.ts`, then mount the router in `src/app.ts`. A **new module** also
   gets its row in `architecture.md` → Module dependency map and in
   `src/architecture/module-dependency-map.ts`, or the architecture test fails. A `/cms` router
   adds no Origin check of its own: the app factory's allow-list already covers its non-GET
   routes (`owner-auth.T06`), and each of them documents the 403 `OriginNotAllowed` response
7. **Update the OpenAPI document — same PR, mandatory**
See `.agent/workflows/generate-plan.md` for the full checklist.

## API documentation (mandatory)
- **Spec file:** `apps/api/openapi/openapi.yaml` (OpenAPI 3.1). It does not exist until
  `monorepo-foundation.T06` creates it — do not assume it is there before that task is done.
- **Rule:** every new or changed route (path, method, auth, body, query, headers) is reflected in
  the spec **in the same change**. CI fails when the mounted route table and the document differ.
- Each operation carries its spec ID in `operationId` / `x-spec-id` (for example
  `publish-pipeline.API03`), so a route is traceable to its contract.
- Version bumps: `constitution.md` → Versioning Rules.

## Per-module file pattern
```
modules/<name>/
├── index.ts               # Public surface: interfaces + types ONLY
├── <name>.interface.ts    # Contracts — no implementation
├── <name>.controller.ts   # HTTP in/out only
├── <name>.service.ts      # Business logic, implements the interface
├── <name>.repository.ts   # MongoDB queries only
├── <name>.routes.ts       # Router factory + mount + API-doc annotations
├── <name>.types.ts        # Domain types; re-exports contract types from packages/contracts
└── <name>.model.ts        # Mongoose schema — imported by the repository and nothing else
```
A module may add sub-folders for its own strategies (`sections/`, `rules/`, `providers/`,
`steps/`). Every file in them follows the same layer rules.

- **Events:** a module that emits declares its event map (event name → payload type) in
  `index.ts`; its service depends on `IEventPublisher` from `core/events`. A reacting module's
  handler is a class implementing `IEventHandler`, subscribed in `container.ts`. Semantics:
  `architecture.md` → In-process events.
- **Tests:** specs sit next to the file under test. Repository and route specs get a real
  `mongod` from `MongoTestHarness` (and, for Redis-backed stores, a real Redis database from
  `RedisTestHarness`), fixtures come from a `FixtureFactory` subclass in
  `src/testing/`, and log assertions use `RecordingLogger` — `.agent/workflows/generate-tests.md`.

## Standardised response shape
```typescript
{ success: boolean, message: string, data?: unknown }
```
Every endpoint returns this shape through `core/http/respond.ts` (`ok`, `created`, `accepted`,
`fail`) — never an ad-hoc object. On failure `data` is `{ code: string, ...details }`.

### Error codes (canonical list — specs reference these, they do not redefine them)
| HTTP | `data.code` | Extra fields in `data` |
|---|---|---|
| 400 | `VALIDATION_FAILED` | `errors: [{ path, message }]` |
| 400 | `OTP_INVALID` | — (unknown reference, used-up attempts or wrong code; `owner-auth`) |
| 400 | `OTP_EXPIRED` | — (`owner-auth`) |
| 401 | `UNAUTHENTICATED` | — |
| 401 | `SESSION_EXPIRED` | — (a newer sign-in replaced this session; `owner-auth`) |
| 403 | `ORIGIN_NOT_ALLOWED` | — |
| 404 | `NOT_FOUND` | — |
| 409 | `REVISION_CONFLICT` | `currentRevision` |
| 409 | feature-specific (named in the owning spec) | per spec |
| 413 | `PAYLOAD_TOO_LARGE` | `maxBytes` |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | `allowed: string[]` |
| 422 | `PUBLISH_BLOCKED` | `issues: PublishIssue[]` |
| 429 | `RATE_LIMITED` | `retryAfterSec` (also `Retry-After` header) |
| 500 | `INTERNAL_ERROR` | — (never a stack trace or driver message) |
| 502 | `UPSTREAM_FAILED` | `provider` |
| 503 | `SERVICE_UNAVAILABLE` | — |

## Errors
- Services throw subclasses of `AppError` from `core/errors/` (`ValidationError`,
  `NotFoundError`, `ConflictError`, `UpstreamError`, …). They never build an HTTP response.
- One error middleware, registered last, maps `AppError` to the table above and anything else to
  `INTERNAL_ERROR`, logging the original with a request id.
- Adapters catch provider errors and rethrow `UpstreamError`; no provider-specific type crosses
  a port.

## Input validation
- Schemas live in `packages/contracts` and are re-exported from `<name>.types.ts`.
- A single `validate(schema, source?)` middleware parses `req[source]` and stores the result on
  `req.validatedBody` / `req.validatedQuery` / `req.validatedParams`. Controllers read the
  validated value and never re-parse the raw request.
- Every module uses this pattern — no per-module exceptions.
- Free-text strings pass through the shared `plainText` schema helper (trim, strip HTML tags and
  control characters, enforce max length).

## Optimistic concurrency
Mutable documents carry an integer `revision`. Every write sends `expectedRevision`; the
repository performs a single conditional update (`{ _id, revision: expected }` →
`$inc: { revision: 1 }`). Zero documents matched → `ConflictError('REVISION_CONFLICT')`.

## Persistence conventions
- Repositories return plain domain objects (`lean()` + mapper), never Mongoose documents.
- Every content document carries `portfolioId`; every query filters by it. It is the tenant
  boundary: each user owns their own portfolio (ADR-0010), so a `/cms` query that does not
  filter by a portfolio the signed-in user owns is a security defect, not a style issue.
- Indexes are declared in the model file and listed in the owning plan's Data Model section.
- IDs exposed over HTTP are strings; embedded list items carry their own stable `id` (nanoid).

## Configuration
`config/env.ts` parses `process.env` once with zod and exports a frozen, typed `env`. It is
injected through the container. No other file reads `process.env`. A new variable is added in the
same change to `architecture.md` → Environment, `apps/api/.env.example` (commented until
`env.ts` reads it) and `turbo.json`; `config/env-example.spec.ts` fails if the example drifts.

## Logging
Structured JSON logs with a request id. See `constitution.md` → PII / logging rules for what
must never be logged.

## Framework-specific notes
- **Express 5:** a rejected promise from an async handler reaches the error middleware
  automatically — do not add `try/catch` wrappers or an `asyncHandler` helper around handlers.
- **Controllers are classes with arrow-function handlers** (or bound in the constructor) so
  `this` survives being passed to the router.
- **Multipart:** parsed only on the upload route, streaming to `IFileStorage`; `express.json()`
  keeps its default body limit everywhere else.
