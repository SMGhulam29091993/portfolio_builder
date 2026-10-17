# next.md
## Queued
1. Confirm the CI run on `master` after the PR #9 merge (`monorepo-foundation.T10`), and the
   first CI run of `feat/owner-auth-t01-t03` once pushed — it is the first to use the Redis
   service container. A red run reopens the task it breaks.
2. `owner-auth.T04` — `SessionAuthorizer` (triple `jti` match) and `AuthService` (login,
   refresh, logout, me) on the fakes from T02 and T03. Unblocked: T03 is completed. Branch: ask
   the owner whether T04 continues `feat/owner-auth-t01-t03` or starts its own after that
   branch is merged. In-memory fakes of `IUserReader`
   need a contract suite with `UserRepository`. `JWT_ACCESS_SECRET` joins `env.ts` with the
   container wiring in T05.
3. `section-engine.T01` — blocked on: ADR-0005 accepted; `owner-auth` implemented.
4. `cms-panel-shell` picks up the revised session handling (AC3, `SESSION_EXPIRED`, cross-tab
   refresh lock) and the forgot-password screen (AC15) when it is built.
5. Owner decisions still open in `blockers.md` — blocked on: the owner. Raised 2026-10-17: the
   two cycles allowed by the module dependency map (blocks `publish-pipeline.T02`), and
   whether to untrack the build output and symlinks still committed (blocks nothing).

Order after that follows `project_context.md` → Feature slugs (build order).
