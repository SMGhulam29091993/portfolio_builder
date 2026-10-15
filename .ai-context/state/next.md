# next.md
## Queued
1. `monorepo-foundation.T06` — `health` module, `container.ts`, `app.ts` mounting the T04/T05
   middleware in the `architecture.md` → Request lifecycle order, a rate limiter on `/health`,
   `openapi/openapi.yaml` and the drift check. Not blocked. Starts once the owner has merged
   T04 and T05. Also replaces `main.ts`'s placeholder listener.
2. `monorepo-foundation.T07`–`T10`, in task-file order. T07 must let `main.ts` construct core
   infrastructure (logger, lifecycle, `MongoConnection`) — see `memory/review-findings.md`,
   2026-10-15.
3. `owner-auth.T01` — blocked on: `monorepo-foundation` implemented; the spec moved to `Ready`.
4. `section-engine.T01` — blocked on: ADR-0005 accepted; `owner-auth` implemented.
5. Owner decisions still open in `blockers.md` — blocked on: the owner.

Order after that follows `project_context.md` → Feature slugs (build order).
