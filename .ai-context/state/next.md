# next.md
## Queued
1. `monorepo-foundation.T04` — `core/errors` and `core/http`: `respond` helpers, `AppError`
   hierarchy, `validate()`, `notFound`, `errorHandler`, JSON body limits. Not blocked. Starts
   once the owner has merged `feat/foundation-t03-api-bootstrap` (T04 builds on `apps/api`).
2. `monorepo-foundation.T05`–`T10`, in task-file order. T09 (CI workflow) is no longer blocked:
   the GitHub remote exists. T07 must let `main.ts` construct core infrastructure (logger,
   lifecycle, `MongoConnection`) — see `memory/review-findings.md`, 2026-10-15.
3. `owner-auth.T01` — blocked on: `monorepo-foundation` implemented; the spec moved to `Ready`.
4. `section-engine.T01` — blocked on: ADR-0005 accepted; `owner-auth` implemented.
5. Owner decisions still open in `blockers.md` — blocked on: the owner.

Order after that follows `project_context.md` → Feature slugs (build order).
