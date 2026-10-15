# next.md
## Queued
1. `monorepo-foundation.T07` — import-boundary lint rules (layer, module, `process.env`,
   instantiation) and the architecture test against the dependency map. Not blocked. Starts
   once the owner has merged `feat/foundation-t06-health-app-openapi`. The instantiation rule
   must allow `main.ts` and `src/openapi/check-drift.ts` to construct core infrastructure — see
   `memory/review-findings.md`, 2026-10-15.
2. `monorepo-foundation.T08`–`T10`, in task-file order. T09's CI runs `pnpm drift` alongside
   build / typecheck / lint / test.
3. `owner-auth.T01` — blocked on: `monorepo-foundation` implemented; the spec moved to `Ready`.
4. `section-engine.T01` — blocked on: ADR-0005 accepted; `owner-auth` implemented.
5. Owner decisions still open in `blockers.md` — blocked on: the owner.

Order after that follows `project_context.md` → Feature slugs (build order).
