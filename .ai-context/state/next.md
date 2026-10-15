# next.md
## Queued
1. `monorepo-foundation.T05` — security middleware: `helmet`, request id, `RateLimiterFactory`
   with an in-memory store, applied to `/health`. Not blocked. Starts once the owner has merged
   `feat/foundation-t04-http-core`. The request-id middleware sets `req.requestId`, which the
   error middleware already logs; `RateLimitedError` already exists in `core/errors`.
2. `monorepo-foundation.T06`–`T10`, in task-file order. T07 must let `main.ts` construct core
   infrastructure (logger, lifecycle, `MongoConnection`) — see `memory/review-findings.md`,
   2026-10-15.
3. `owner-auth.T01` — blocked on: `monorepo-foundation` implemented; the spec moved to `Ready`.
4. `section-engine.T01` — blocked on: ADR-0005 accepted; `owner-auth` implemented.
5. Owner decisions still open in `blockers.md` — blocked on: the owner.

Order after that follows `project_context.md` → Feature slugs (build order).
