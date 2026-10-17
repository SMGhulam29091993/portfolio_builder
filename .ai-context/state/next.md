# next.md
## Queued
1. Confirm the CI run on `master` after the PR #9 merge (`monorepo-foundation.T10`); a red run
   reopens T10 and moves the spec back to `In Progress`.
2. `owner-auth.T01` (Redis infrastructure) — blocked on: the owner moving `owner-auth` to
   `Ready` (DoR self-check passed 2026-10-17 after the revision). Its variables are listed,
   commented, in `apps/api/.env.example` (`WEB_ORIGIN`, `JWT_ACCESS_SECRET`, `OWNER_EMAIL`,
   `OWNER_PASSWORD`, `REDIS_URL`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `MAIL_FROM`); uncomment
   each as `env.ts` starts reading it.
3. `section-engine.T01` — blocked on: ADR-0005 accepted; `owner-auth` implemented.
4. `cms-panel-shell` picks up the revised session handling (AC3, `SESSION_EXPIRED`, cross-tab
   refresh lock) and the forgot-password screen (AC15) when it is built.
5. Owner decisions still open in `blockers.md` — blocked on: the owner. Raised 2026-10-17: the
   two cycles allowed by the module dependency map (blocks `publish-pipeline.T02`), and
   whether to untrack the build output and symlinks still committed (blocks nothing).

Order after that follows `project_context.md` → Feature slugs (build order).
