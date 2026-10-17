# Plan: Monorepo Foundation
## Derived From
.ai-context/specs/monorepo-foundation.spec.md
## Architecture Approach
- **Workspace:** pnpm workspaces + Turborepo pipeline (`build`, `typecheck`, `lint`, `test`,
  `dev`). `packages/tsconfig` and `packages/eslint-config` are consumed by every workspace.
- **`apps/api/src/core/`** (new, cross-cutting, no business logic):
  - `config/env.ts` — zod schema → frozen `Env`; the only reader of `process.env`.
  - `core/db/MongoConnection` — the one Singleton (global cache outside production).
  - `core/errors/` — `AppError` + subclasses.
  - `core/http/` — `respond.ts` helpers, `validate()` middleware, `notFound`, `errorHandler`,
    `requestId`, `RateLimiterFactory` (in-memory store).
  - `core/events/` — `IEventBus` + `InProcessEventBus` (used first by `publish-pipeline`).
  - `core/logger/` — `ILogger` + JSON implementation.
- **`main.ts`** startup: env → connect → `buildContainer(env, connection)` → `createApp(container)`
  → listen → register `SIGTERM`/`SIGINT` handlers.
- **`container.ts`** — composition root; returns typed routers. `health` is the first module
  wired, in the module file pattern, proving the path end to end.
- **Boundary enforcement:** lint import-restriction rules per layer and per module, plus one
  architecture test asserting the module dependency map in `architecture.md`. _Built in T07 as
  the local `portfolio` ESLint plugin (one rule id per AC9 case) and `apps/api/src/architecture/`
  — current shape in `architecture.md` → Boundary enforcement._
- **OpenAPI:** `apps/api/openapi/openapi.yaml`; a drift script compares it with the route table
  the app exposes in test mode.
- **`apps/web`:** Next.js App Router, Tailwind, route groups `(site)` and `(cms)`, a rewrite of
  `/api/v1/:path*` to `API_INTERNAL_URL`. _Built in T08: `src/lib/env.ts` validates the
  environment inside `rewrites()`, `src/lib/api-proxy.ts` builds the rewrite, and E2E01 runs
  through `pnpm test:e2e` with `e2e/start-api.ts` (throwaway MongoDB + built API) — current
  shape in `architecture.md` → Repository layout and Environment._
- **Patterns used:** Singleton (DB connection), Factory (rate limiter), Observer seam
  (`IEventBus`) — all from the approved list.
## Data Model
No collections. The health probe issues a `ping` admin command only.
## Constitution Check
- [x] No new datastore introduced without ADR (MongoDB only; rate limiting is in-memory)
- [x] Layer and module boundaries enforced by lint + architecture test, not documentation
- [x] Startup sequence verifies DB reachability before listening
- [x] No business payload hardcoded (health reports runtime facts only)
- [x] Testing discipline matches constitution.md — ADR-0007 accepted 2026-10-15
## Explicitly Deferred
- Deployment and hosting — no target chosen (BRD-007, open).
- Generating OpenAPI from contracts — start hand-maintained with a drift check; revisit if the
  document becomes a maintenance burden (would need a `memory/lessons.md` entry first).
- Distributed rate limiting — needs Redis, which needs an ADR.
## Sequencing
1. Workspace + shared config packages
2. Package skeletons
3. API core: env, logger, DB, startup
4. HTTP core: envelope, errors, validation
5. Security middleware
6. Health module, container, OpenAPI + drift check
7. Boundary lint + architecture test
8. Web scaffold + proxy
9. Test harness, coverage floor, CI
10. Local dev environment
