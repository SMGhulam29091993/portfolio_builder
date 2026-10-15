# next.md
## Queued
1. `monorepo-foundation.T03` — `apps/api`: `config/env.ts`, `ILogger`, `MongoConnection`
   singleton, `main.ts` startup sequence and graceful shutdown. Not blocked; tests run against a
   real `mongod` through `mongodb-memory-server`.
2. `monorepo-foundation.T04`–`T10`, in task-file order. T09 (CI workflow) needs a git remote —
   blocked on: the owner adding one.
3. `owner-auth.T01` — blocked on: `monorepo-foundation` implemented; the spec moved to `Ready`.
4. `section-engine.T01` — blocked on: ADR-0005 accepted; `owner-auth` implemented.
5. Owner decisions still open in `blockers.md` — blocked on: the owner.

Order after that follows `project_context.md` → Feature slugs (build order).
