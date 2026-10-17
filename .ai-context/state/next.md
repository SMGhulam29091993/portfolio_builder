# next.md
## Queued
1. Confirm CI on `master` after the PR #10 merge — the first `master` run with the Redis service
   container — and the first CI run of `feat/owner-auth-t04-auth-service` once pushed. A red
   run reopens the task it breaks.
2. `owner-auth.T05` — `AuthController`, `SessionCookieWriter`, `auth.routes.ts` (API01–API04),
   `RequireOwnerMiddleware` on `ISessionAuthorizer`; wire `SessionAuthorizer` and `AuthService`
   (built in T04, not yet in `container.ts`) and `JWT_ACCESS_SECRET` into `env.ts`; OpenAPI.
   Unblocked: T04 is completed. Branch: a new `feat/owner-auth-t05-…` off `master` once T04 is
   merged. Carried from T04: services throw `SessionExpiredError` / `UnauthenticatedError` and
   never touch cookies, so the controller and guard clear all three cookies on those 401s
   (spec → API02 exceptions); a Redis outage currently surfaces as a plain error (500), and the
   spec wants 503 `SERVICE_UNAVAILABLE` from the guard and every auth route (IT13 second half).
3. `section-engine.T01` — blocked on: ADR-0005 accepted; `owner-auth` implemented.
4. `cms-panel-shell` picks up the revised session handling (AC3, `SESSION_EXPIRED`, cross-tab
   refresh lock) and the forgot-password screen (AC15) when it is built.
5. Owner decisions still open in `blockers.md` — blocked on: the owner. Raised 2026-10-17: the
   two cycles allowed by the module dependency map (blocks `publish-pipeline.T02`), and
   whether to untrack the build output and symlinks still committed (blocks nothing).

Order after that follows `project_context.md` → Feature slugs (build order).
