# Plan: Owner Authentication
## Derived From
.ai-context/specs/owner-auth.spec.md
## Architecture Approach
Module `apps/api/src/modules/auth/` in the module file pattern. Redis use follows ADR-0008, mail
follows ADR-0009.
| Class | Layer | Implements | Depends on (interfaces) |
|---|---|---|---|
| `AuthController` | Controller | — | `IAuthService`, `ISessionCookieWriter` (`owner-auth.T05`), `IPasswordResetService` (`owner-auth.T08`) |
| `AuthService` | Service | `IAuthService` (login, refresh, logout, me) | `IUserReader`, `ISessionStore`, `ISessionAuthorizer`, `IPasswordHasher`, `ITokenIssuer`, `ISecureRandom`, `IClock` (the session's `issuedAt`; added in `owner-auth.T04`) |
| `SessionAuthorizer` | Service | `ISessionAuthorizer` (guard steps 1–3, with an "ignore expiry" mode for refresh and logout) | `ITokenIssuer`, `ISessionStore` |
| `PasswordResetService` | Service | `IPasswordResetService` (requestCode, resend, reset) | `IUserReader`, `IUserPasswordWriter`, `IOtpRepository`, `IOtpReferenceStore`, `IOtpHasher`, `IPasswordHasher`, `ISessionStore`, `IMailSender`, `ISecureRandom`, `IClock` |
| `UserRepository`, `OtpRepository` | Repository | `IUserReader`, `IUserCreator`, `IUserPasswordWriter` (role-sized, `owner-auth.T02`), `IOtpRepository` | Mongoose models |
| `RedisSessionStore`, `RedisOtpReferenceStore` | Repository (Redis) | `ISessionStore` (get, replace, compareAndSet, deleteIfJti, delete), `IOtpReferenceStore` (put, resolve, delete) | the `core` Redis client; every command through `whileRedisAvailable` (503 on failure; session store since `owner-auth.T05`, reference store in `T08`) |
| `Argon2PasswordHasher` | Adapter | `IPasswordHasher` | — |
| `BcryptOtpHasher` | Adapter | `IOtpHasher` (hash, compare) | — |
| `JwtTokenIssuer` | Adapter | `ITokenIssuer` (sign / verify the access token, with an ignore-expiry option) | options (secret from `JWT_ACCESS_SECRET`, TTL, leeway) passed by the container, `IClock` |
| `CryptoSecureRandom` | Adapter | `ISecureRandom` (bytes, 6-digit code) | — |
| `SystemClock` | Adapter | `IClock` | — |
| `GmailMailSender`, `DisabledMailSender` | Adapter | `IMailSender` | options (user, app password, sender) built by the container from `Env` (Gmail only) |
| `MailSenderFactory` | Factory | — | `MailStrategy` registrations and the disabled sender from the container; `Env` per call |
| `RequireOwnerMiddleware` | HTTP | — (its `handle` is the `IAuthGuard`) | `ISessionAuthorizer`, `ISessionCookieWriter` |
| `SessionCookieWriter` | HTTP | `ISessionCookieWriter` (read, write, clear) | `Env` (`NODE_ENV`), cookie paths and lifetime from the container; `core/http` `parseCookieHeader` |
| `OriginAllowListMiddleware` | HTTP (`core/http`) | — | `Env` |
| `OwnerSeeder` | Seed | `ISeeder` | `IUserReader`, `IUserCreator`, `IPasswordHasher`, `Env` |
- `index.ts` exports `IAuthGuard` (the `requireOwner` handler type) and `AuthContext`; other
  modules receive the guard instance from the container and import nothing else.
- The three cookies are read and written only by `SessionCookieWriter`, used by the controller
  and the guard — services never see `req`/`res`, and cookie flags come from the injected `env`.
  The guard clears them on `SESSION_EXPIRED` only; refresh clears them on every 401
  (`owner-auth.T05`; `memory/review-findings.md`, 2026-10-17).
- `SessionAuthorizer` is the one implementation of the `jti` triple match, shared by the guard,
  refresh and logout, so the rule cannot diverge between them.
- The SHA-256 of a refresh token is a pure helper in `core/crypto` (no state, no I/O).
- `ISecureRandom` and `IClock` are injected so code generation, expiry, cooldown and rate-limit
  tests are deterministic. The container's `RateLimiterFactory` runs on the same `IClock`
  (`owner-auth.T06`).
- Login limit (`owner-auth.T06`): `LOGIN_RATE_LIMIT` in `container.ts` — key `loginAttemptKey`
  (client IP + lower-cased email, read before validation), 5 per 15 minutes, counting 401s only
  through the factory's `counts` option; a slot is held while its request is in flight.
- Origin allow-list (`owner-auth.T06`): mounted by `app.ts` on the `/auth` and `/cms` prefixes
  ahead of every router, so it runs before the limiter and the guard and covers future `/cms`
  modules without any code in them (`architecture.md` → Request lifecycle).
- Mail (`owner-auth.T07`): `MAIL_STRATEGIES` in `container.ts` lists the strategies in priority
  order, each declared with `MailSenderFactory.strategy(variables, create)`; the factory runs
  while the container is built, so production without one fails startup with
  `MailNotConfiguredError` naming the unset variables, and `ApplicationLifecycle` closes both
  datastores again. `GmailMailSender` logs nodemailer's error code and SMTP status only, never
  its message, which can quote the recipient back. SMTP bounds: 10 s connect, 10 s greeting,
  20 s socket.
- Password reset (`owner-auth.T08`): `PasswordResetService` mints the code, the 64-hex
  identifier and the reference (`bcrypt(identifier)`) together, so an unknown address costs the
  same two bcrypt hashes and gets a decoy reference of the same shape, with nothing written or
  sent. `reset` refuses a used-up code before comparing, answers `OTP_EXPIRED` before spending
  an attempt, then **claims the attempt with the atomic `incrementAttempts` before comparing**,
  so guesses sent in parallel get at most five compares between them
  (`memory/review-findings.md`, 2026-10-18). `IMailSender.ensureAvailable()` runs first in
  `requestCode` and `resend`, so with mail disabled API05 and API06 answer 503 for every address
  and write nothing (AC22). `CODE_SEND_RATE_LIMIT` in `container.ts`: one limiter instance on
  API05 and API06, keyed by IP, 5 per hour, counting every admitted request and running before
  validation; API07 has no limiter of its own — guessing is bounded by five attempts per code
  and the send limit on new codes. Tests swap the mail strategy through the container's optional
  `mailSender` (a `RecordingMailSender`); production never passes it, so the factory always
  decides there.
- The Redis client is created in `core/` (ADR-0008); `RedisSessionStore.compareAndSet` is a Lua
  script that replaces the session only while the stored `jti` equals the presented one. The
  client's offline queue is off, so a command fails at once while Redis is down and the store
  answers 503 instead of waiting (`owner-auth.T05`; `memory/pitfalls.md`, 2026-10-17).
- Patterns: Repository; Adapter + Factory (`IMailSender` strategies, hashers, token issuer) —
  all from the approved list.
- argon2id cost, measured 2026-10-17 (`owner-auth.T03`): m=64 MiB, t=3, p=4 takes ~33 ms per
  hash and per verify on the development machine — above the OWASP minimum (19 MiB, t=2) and
  cheap for one owner's sign-ins. Pinned in `Argon2PasswordHasher`, not left to library defaults.
## Data Model
**`users`** (MongoDB) — `_id`, `email` (unique, lower-case), `passwordHash`, `displayName`,
`passwordChangedAt`, `createdAt`, `updatedAt`.
**`otps`** (MongoDB) — `_id`, `userId`, `purpose` (`password_reset`), `identifier` (unique),
`otpHash`, `attempts`, `sentAt`, `expiresAt`, `purgeAt` (TTL index, `expireAfterSeconds: 0`),
`createdAt`, `updatedAt`. Unique compound index `{ userId, purpose }` — the upsert key.
**Redis** — `auth:session:<userId>` → a hash with the fields `jti`, `refreshTokenHash` and `issuedAt` (epoch ms; a hash so the Lua scripts read the `jti` with `HGET`, `owner-auth.T02`), TTL 7 days;
`auth:otp-ref:<reference>` → identifier, TTL 24 hours.
Seed: one user from `OWNER_EMAIL` / `OWNER_PASSWORD`; no literal credentials anywhere.
## Constitution Check
- [x] No new datastore introduced without ADR — Redis by ADR-0008 (accepted 2026-10-17)
- [x] No new external service without ADR — mail by ADR-0009 (accepted 2026-10-17)
- [x] Auth boundary: `users` only; no external provider is an identity path
- [x] Only interfaces cross layers; classes instantiated in `container.ts`
- [x] Nothing logged from the PII/secret list, including codes, identifiers and references
- [x] Test-first scope covers all seven endpoints, the guard and the reset flow
- [x] Dev-bypass shape for mail: disabled outside production only; production fails fast
- [x] argon2id for passwords and bcrypt for one-time codes — ADR-0007, amended 2026-10-17
## Explicitly Deferred
- Changing the password while signed in.
- 2FA at sign-in — open at BRD stage.
- Brevo or any other mail strategy — the factory leaves its place; no class is written.
- Rate-limit counters in Redis — stays in process memory (ADR-0008, Consequences).
- An absolute session lifetime cap — sessions slide with every refresh.
## Sequencing
1. Redis infrastructure: compose service, CI service, `core` client, startup ping, shutdown
2. Contracts, `users` and `otps` models, repositories, Redis stores
3. Hasher, token-issuer, random and clock adapters
4. `SessionAuthorizer` and `AuthService`
5. Controller, cookies, routes API01–API04, `requireOwner`, container wiring, OpenAPI
6. Login rate limit and Origin allow-list
7. Mail port, Gmail strategy, factory
8. `PasswordResetService`, routes API05–API07, send limit, OpenAPI
9. Owner seeder
