# next.md
## Queued
1. Confirm CI on `master` after the PR #12 merge, and the first CI run of
   `feat/owner-auth-t06-rate-limit-origin` once pushed. A red run reopens the task it breaks.
2. `owner-auth.T07` — `IMailSender`, `GmailMailSender` (nodemailer), `DisabledMailSender`,
   `MailSenderFactory`; `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `MAIL_FROM` in `env.ts`; production
   fail-fast; contract suite and `RecordingMailSender` (AC22). Unblocked: T06 is completed.
   Branch: a new `feat/owner-auth-t07-…` off `master` once T06 is merged.
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
