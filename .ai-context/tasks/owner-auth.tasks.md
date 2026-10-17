# Tasks: Owner Authentication
## Derived From
.ai-context/plans/owner-auth.plan.md
## Sequence
- [x] owner-auth.T01 — Redis infrastructure: pinned `redis` image in `docker-compose.dev.yml`, Redis service in CI, `core` Redis client (singleton), `REDIS_URL` in `env.ts`, startup ping after MongoDB, close on shutdown; pins in ADR-0007 — Acceptance: ADR-0008 (startup and shutdown), IT13 startup half (the guarded-route half needs `requireOwner`, so it lands with T05)
- [x] owner-auth.T02 — Contract schemas (`packages/contracts/src/auth`, API01–API07), `users` and `otps` models with indexes, `UserRepository`, `OtpRepository`; `ISessionStore` → `RedisSessionStore` (with compare-and-set), `IOtpReferenceStore` → `RedisOtpReferenceStore`, in-memory fakes and their contract suites — Acceptance: AC1, AC10, AC16
- [x] owner-auth.T03 — `IPasswordHasher` → `Argon2PasswordHasher`; `IOtpHasher` → `BcryptOtpHasher`; `ITokenIssuer` → `JwtTokenIssuer`; `ISecureRandom` → `CryptoSecureRandom`; `IClock` → `SystemClock`; `core/crypto` SHA-256 helper; contract suites — Acceptance: AC1, AC5
- [ ] owner-auth.T04 — `SessionAuthorizer` (triple `jti` match) and `AuthService`: login (constant-work on unknown email, replaces the session), refresh (signature-only verify, refresh-hash check, compare-and-set rotation), logout, me — Acceptance: AC1, AC2, AC4–AC11
- [ ] owner-auth.T05 — `AuthController`, `SessionCookieWriter` (three cookies), `auth.routes.ts` for API01–API04, `RequireOwnerMiddleware`; wire in `container.ts`; `SESSION_EXPIRED` in the error mapping; document API01–API04 in OpenAPI — Acceptance: AC1, AC4–AC8, AC11, AC15
- [ ] owner-auth.T06 — Login rate limiter (IP + email, 5 per 15 min) and `OriginAllowListMiddleware` on `/auth` and `/cms` — Acceptance: AC3, AC12
- [ ] owner-auth.T07 — `IMailSender`, `GmailMailSender` (nodemailer), `DisabledMailSender`, `MailSenderFactory`; `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `MAIL_FROM` in `env.ts`; production fail-fast; contract suite and `RecordingMailSender` — Acceptance: AC22
- [ ] owner-auth.T08 — `PasswordResetService` (request, resend, reset), routes API05–API07, send limiter (5 per hour per IP), `OTP_INVALID` / `OTP_EXPIRED` in the error mapping, OpenAPI — Acceptance: AC15–AC21
- [ ] owner-auth.T09 — `OwnerSeeder` (idempotent, 12-character minimum) and the `seed:owner` script — Acceptance: AC13, AC14
