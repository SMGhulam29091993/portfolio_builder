# next.md
## Queued
1. Confirm CI on `master` after the PR #13 merge, and the first CI run of
   `feat/owner-auth-t07-mail-port` once pushed. A red run reopens the task it breaks.
2. `owner-auth.T08` — `PasswordResetService` (request, resend, reset), routes API05–API07, send
   limiter, `OTP_INVALID` / `OTP_EXPIRED` mapping, OpenAPI (AC15–AC21). Unblocked: T07 is
   completed. Branch: a new `feat/owner-auth-t08-…` off `master` once T07 is merged.
   From T07: the container already builds the mail sender (`new MailSenderFactory(...)
   .create(env)`, result unused) — T08 assigns it and injects it into `PasswordResetService`;
   route tests pass a `RecordingMailSender` (its `refuseSends()` gives the 502 path); the
   development half of `owner-auth.IT22` (forgot → 503 with no strategy, login still 200)
   lands with API05.
   Carried to T08: wrap `RedisOtpReferenceStore`'s commands in `whileRedisAvailable` as T05 did
   for the session store, so API05–API07 also answer 503 while Redis is down; the send limiter
   (5 per hour per IP) reuses `RateLimiterFactory`, and API05–API07 get the 403
   `OriginNotAllowed` response in OpenAPI (the allow-list already covers them).
   Carried to the deployment target: set Express `trust proxy` to the real hop count — until
   then `req.ip` is the web server's address behind the `/api/v1` rewrite and the login limit
   is effectively per email (`memory/review-findings.md`, 2026-10-18).
3. `section-engine.T01` — blocked on: ADR-0005 accepted; `owner-auth` implemented.
4. `cms-panel-shell` picks up the revised session handling (AC3, `SESSION_EXPIRED`, cross-tab
   refresh lock) and the forgot-password screen (AC15) when it is built.
5. Owner decisions still open in `blockers.md` — blocked on: the owner. Raised 2026-10-17: the
   two cycles allowed by the module dependency map (blocks `publish-pipeline.T02`), and
   whether to untrack the build output and symlinks still committed (blocks nothing).

Order after that follows `project_context.md` → Feature slugs (build order).
