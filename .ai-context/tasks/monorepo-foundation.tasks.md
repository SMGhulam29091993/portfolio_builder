# Tasks: Monorepo Foundation
## Derived From
.ai-context/plans/monorepo-foundation.plan.md
## Sequence
- [x] monorepo-foundation.T01 — Create the pnpm + Turborepo workspace, `packages/tsconfig`, `packages/eslint-config`, `turbo.json` pipeline; pin exact dependency versions and record them in ADR-0007 — Acceptance: AC1
- [x] monorepo-foundation.T02 — Add buildable skeletons for `packages/contracts`, `packages/design-tokens`, `packages/sections` (empty public exports) — Acceptance: AC1
- [x] monorepo-foundation.T03 — `apps/api`: `config/env.ts`, `ILogger`, `MongoConnection` singleton, `main.ts` startup sequence and graceful shutdown — Acceptance: AC2, AC3, AC13
- [x] monorepo-foundation.T04 — `core/errors` and `core/http`: `respond` helpers, `AppError` hierarchy, `validate()`, `notFound`, `errorHandler`, JSON body limits — Acceptance: AC6, AC7, AC8
- [x] monorepo-foundation.T05 — Security middleware: `helmet`, request id, `RateLimiterFactory` with in-memory store — Acceptance: AC11 _(2026-10-15: "applied to `/health`" moved to T06, which creates that route — see `state/completed.md`)_
- [x] monorepo-foundation.T06 — `health` module in the module file pattern, `container.ts`, `app.ts` (mounting the T05 security middleware and a rate limiter on `/health`); create `openapi/openapi.yaml` and the drift check — Acceptance: AC4, AC5, AC10
- [x] monorepo-foundation.T07 — Import-boundary lint rules (layer, module, `process.env`, instantiation) and the architecture test against the dependency map — Acceptance: AC9
- [ ] monorepo-foundation.T08 — `apps/web`: Next.js App Router, Tailwind, `(site)` and `(cms)` route groups with placeholder pages, `/api/v1` rewrite, `lib/env.ts` — Acceptance: AC12
- [ ] monorepo-foundation.T09 — Test harness (`apps/api/src/testing`: Mongo harness, fixture-factory base), Vitest config with the coverage floor, `InProcessEventBus`, CI workflow running build / typecheck / lint / test / drift — Acceptance: AC1
- [ ] monorepo-foundation.T10 — `docker-compose.dev.yml` (MongoDB), `.env.example` for both apps listing every variable in `architecture.md` → Environment, developer README section — Acceptance: AC12
