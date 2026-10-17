# Plan: Owner Authentication
## Derived From
.ai-context/specs/owner-auth.spec.md
## Architecture Approach
Module `apps/api/src/modules/auth/` in the module file pattern. Redis use follows ADR-0008, mail
follows ADR-0009.
| Class | Layer | Implements | Depends on (interfaces) |
|---|---|---|---|
| `AuthController` | Controller | — | `IAuthService`, `IPasswordResetService` |
| `AuthService` | Service | `IAuthService` (login, refresh, logout, me) | `IUserReader`, `ISessionStore`, `ISessionAuthorizer`, `IPasswordHasher`, `ITokenIssuer`, `ISecureRandom`, `IClock` (the session's `issuedAt`; added in `owner-auth.T04`) |
| `SessionAuthorizer` | Service | `ISessionAuthorizer` (guard steps 1–3, with an "ignore expiry" mode for refresh and logout) | `ITokenIssuer`, `ISessionStore` |
| `PasswordResetService` | Service | `IPasswordResetService` (requestCode, resend, reset) | `IUserRepository`, `IOtpRepository`, `IOtpReferenceStore`, `IOtpHasher`, `IPasswordHasher`, `ISessionStore`, `IMailSender`, `ISecureRandom`, `IClock` |
| `UserRepository`, `OtpRepository` | Repository | `IUserRepository`, `IOtpRepository` | Mongoose models |
| `RedisSessionStore`, `RedisOtpReferenceStore` | Repository (Redis) | `ISessionStore` (get, replace, compareAndSet, delete), `IOtpReferenceStore` (put, resolve, delete) | the `core` Redis client |
| `Argon2PasswordHasher` | Adapter | `IPasswordHasher` | — |
| `BcryptOtpHasher` | Adapter | `IOtpHasher` (hash, compare) | — |
| `JwtTokenIssuer` | Adapter | `ITokenIssuer` (sign / verify the access token, with an ignore-expiry option) | `Env`, `IClock` |
| `CryptoSecureRandom` | Adapter | `ISecureRandom` (bytes, 6-digit code) | — |
| `SystemClock` | Adapter | `IClock` | — |
| `GmailMailSender`, `DisabledMailSender` | Adapter | `IMailSender` | `Env` (Gmail only) |
| `MailSenderFactory` | Factory | — | `Env` |
| `RequireOwnerMiddleware` | HTTP | — | `ISessionAuthorizer` |
| `SessionCookieWriter` | HTTP | — | `Env` |
| `OriginAllowListMiddleware` | HTTP (`core/http`) | — | `Env` |
| `OwnerSeeder` | Seed | `ISeeder` | `IUserRepository`, `IPasswordHasher`, `Env` |
- `index.ts` exports `IAuthGuard` (the `requireOwner` handler type) and `AuthContext`; other
  modules receive the guard instance from the container and import nothing else.
- The three cookies are read and written only by `SessionCookieWriter`, used by the controller
  and the guard — services never see `req`/`res`, and cookie flags come from the injected `env`.
- `SessionAuthorizer` is the one implementation of the `jti` triple match, shared by the guard,
  refresh and logout, so the rule cannot diverge between them.
- The SHA-256 of a refresh token is a pure helper in `core/crypto` (no state, no I/O).
- `ISecureRandom` and `IClock` are injected so code generation, expiry, cooldown and rate-limit
  tests are deterministic.
- The Redis client is created in `core/` (ADR-0008); `RedisSessionStore.compareAndSet` is a Lua
  script that replaces the session only while the stored `jti` equals the presented one.
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
**Redis** — `auth:session:<userId>` → JSON `{ jti, refreshTokenHash, issuedAt }`, TTL 7 days;
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
