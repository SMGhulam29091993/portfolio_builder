# next.md
## Queued
1. `monorepo-foundation.T08` — `apps/web`: Next.js App Router, Tailwind, `(site)` and `(cms)`
   route groups with placeholder pages, `/api/v1` rewrite, `lib/env.ts` (AC12). Not blocked.
   Starts once the owner has merged `feat/foundation-t07-boundary-lint`. Its lint config is the
   shared baseline only — the `portfolio/*` boundary rules are API-specific.
2. `monorepo-foundation.T09`–`T10`, in task-file order. T09's CI runs `pnpm drift` alongside
   build / typecheck / lint / test; the boundary lint rules and the architecture test run inside
   `lint` and `test`.
3. `owner-auth.T01` — blocked on: `monorepo-foundation` implemented; the spec moved to `Ready`.
4. `section-engine.T01` — blocked on: ADR-0005 accepted; `owner-auth` implemented.
5. Owner decisions still open in `blockers.md` — blocked on: the owner. New on 2026-10-17: the
   two cycles allowed by the module dependency map (blocks `publish-pipeline.T02`).

Order after that follows `project_context.md` → Feature slugs (build order).
