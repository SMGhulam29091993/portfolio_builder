# next.md
## Queued
1. Confirm CI on `master` after the PR #11 merge, and the first CI run of
   `feat/owner-auth-t05-routes-guard` once pushed. A red run reopens the task it breaks.
2. `owner-auth.T06` — login rate limiter (IP + email, 5 per 15 min, `RateLimiterFactory`) on
   API01 and `OriginAllowListMiddleware` (`core/http`) on every non-GET under `/auth` and
   `/cms`; `WEB_ORIGIN` into `env.ts`, `.env.example` and `turbo.json`; add the 403 and 429
   responses to API01–API03 in OpenAPI (left out in T05 because nothing returns them yet).
   Unblocked: T05 is completed. Branch: a new `feat/owner-auth-t06-…` off `master` once T05 is
   merged. Carried to T08: wrap `RedisOtpReferenceStore`'s commands in `whileRedisAvailable`
   as T05 did for the session store, so API05–API07 also answer 503 while Redis is down.
3. `section-engine.T01` — blocked on: ADR-0005 accepted; `owner-auth` implemented.
4. `cms-panel-shell` picks up the revised session handling (AC3, `SESSION_EXPIRED`, cross-tab
   refresh lock) and the forgot-password screen (AC15) when it is built.
5. Owner decisions still open in `blockers.md` — blocked on: the owner. Raised 2026-10-17: the
   two cycles allowed by the module dependency map (blocks `publish-pipeline.T02`), and
   whether to untrack the build output and symlinks still committed (blocks nothing).

Order after that follows `project_context.md` → Feature slugs (build order).
