# Test Cases: Owner Authentication
**Spec:** .ai-context/specs/owner-auth.spec.md
**Spec-derived unit cases:** UT01–UT18 are defined in the spec and not restated here.

## Integration (real MongoDB, real Redis, real HTTP)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| owner-auth.IT01 | AC1 | Login with seeded credentials | 200; `Set-Cookie` for `access-token`, `refresh-token`, `jti` with `HttpOnly`, the environment's `SameSite`, correct `Path` and 7-day `Max-Age`; body has no token; Redis session holds the cookie's `jti` and the refresh hash |
| owner-auth.IT02 | AC2 | Wrong password vs unknown email | Byte-identical 401 bodies |
| owner-auth.IT03 | AC3 | Six failed logins, same IP + email | Sixth → 429 with `Retry-After`; a different email from the same IP is not limited |
| owner-auth.IT04 | AC4 | Login, then call a guarded test route | 200; the handler sees the owner's id |
| owner-auth.IT05 | AC5 | Guarded route with no / expired / tampered / wrong-secret access cookie; with the Redis session deleted | 401 `UNAUTHENTICATED` each |
| owner-auth.IT06 | AC6 | Guarded route with the `jti` cookie altered; with the Redis session's `jti` altered | 401 `SESSION_EXPIRED` each; three clearing `Set-Cookie` headers; Redis session unchanged |
| owner-auth.IT07 | AC7 | Login as agent A, login as agent B, then A and B call a guarded route | A → `SESSION_EXPIRED`; B → 200 |
| owner-auth.IT08 | AC8 | Login, advance the clock past 15 min, refresh, then replay the first cookies | Refresh 200 with three new values and a 7-day TTL; replay → `SESSION_EXPIRED` |
| owner-auth.IT09 | AC9 | Refresh with genuine `access-token` and `jti` but a wrong `refresh-token` | 401 `UNAUTHENTICATED`; Redis session gone; the genuine cookies then fail too |
| owner-auth.IT10 | AC10 | Two refreshes fired together with the same cookies | Exactly one 200, one `SESSION_EXPIRED` |
| owner-auth.IT11 | AC11 | Login → logout → refresh; and A/B from IT07 with A calling logout | Logout 200, refresh 401; B's session still present |
| owner-auth.IT12 | AC12 | POST login with no `Origin`, and with a foreign `Origin` | 403 `ORIGIN_NOT_ALLOWED` each |
| owner-auth.IT13 | ADR-0008 | Start the API with Redis unreachable; stop Redis while running and call a guarded route | Startup exits 1 without opening a port and closes MongoDB again (`main.spec.ts`, `application-lifecycle.spec.ts`, `redis-connection.spec.ts` — T01); guarded route → 503 `SERVICE_UNAVAILABLE` (T05) |
| owner-auth.IT14 | AC13 | Run the owner seeder twice | One user; `passwordHash` unchanged on the second run |
| owner-auth.IT15 | AC15 | Capture logs across IT01–IT11 and IT16–IT21 | No password, cookie, token, `jti`, code, identifier, reference or email substring present |
| owner-auth.IT16 | AC16 | Forgot with the owner's email (`RecordingMailSender`) | 200 with a reference; one `otps` document with a bcrypt `otpHash` and `expiresAt` = `sentAt` + 10 min; Redis maps the reference to the identifier; one mail with a 6-digit code |
| owner-auth.IT17 | AC17 | Forgot with an unknown email | Same status and body shape as IT16; no document, key or mail |
| owner-auth.IT18 | AC18 | Forgot → reset with the mailed code → login old/new → reset again | 200; old 401, new 200; document and key gone; old session `UNAUTHENTICATED`; second reset `OTP_INVALID` |
| owner-auth.IT19 | AC19 | Five wrong codes, then the right one | `OTP_INVALID` each time, `attempts` = 5; right code `OTP_INVALID` |
| owner-auth.IT20 | AC20 | Advance the clock 11 min, then reset with the right code | 400 `OTP_EXPIRED`; document present |
| owner-auth.IT21 | AC21 | Resend at 30 s; resend at 61 s; old reference and old code | 429 with `Retry-After`; then new reference and code; old reference `OTP_INVALID` |
| owner-auth.IT22 | AC22 | Boot in production with no mail variables; boot in development with none and call forgot | Startup fails naming the variables; forgot → 503, login → 200 |
| owner-auth.IT23 | Edge | Login with the email in mixed case | 200 |
| owner-auth.IT24 | Edge | Two forgot calls in a row for the owner, then reset with the first reference | Second replaces the document; first reference `OTP_INVALID` |
| owner-auth.IT25 | Edge | `otps` TTL index definition | `purgeAt` with `expireAfterSeconds: 0`; unique `{ userId, purpose }` and `identifier` |

## Contract suites (one suite, every implementation)
| Test ID | Interface | Asserts |
|---|---|---|
| owner-auth.CT01 | `IPasswordHasher` | hash ≠ input; verify true for the right password, false for wrong; two hashes of one password differ — `Argon2PasswordHasher` and `FakePasswordHasher` (T03) |
| owner-auth.CT02 | `ITokenIssuer` | verify(sign(x)) = x; rejects expired (unless ignore-expiry), tampered and wrong-secret tokens; the claims are exactly `sub`, `jti`, `iat`, `exp` |
| owner-auth.CT03 | `ISessionStore` | get / replace / compareAndSet / delete and TTL behave identically for `RedisSessionStore` and the in-memory fake; compareAndSet fails when the `jti` changed |
| owner-auth.CT04 | `IOtpReferenceStore` | put / resolve / delete and TTL behave identically for `RedisOtpReferenceStore` and the in-memory fake |
| owner-auth.CT05 | `IOtpHasher` | compare true for the right code, false for wrong; two hashes of one value differ — `BcryptOtpHasher` and `FakeOtpHasher` (T03) |
| owner-auth.CT08 | `ISecureRandom` | `CryptoSecureRandom` and `SequenceSecureRandom`: base64url 32 → 43 / 16 → 22 characters, hex 32 → 64, 6-digit codes, no repeats (T03) |
| owner-auth.CT09 | `IClock` | `SystemClock` and `ManualClock` return a valid, current, non-decreasing `Date` (T03) |
| owner-auth.CT07 | `IDatabaseConnection` | `MongoConnection` and `RedisConnection` connect, reject when unreachable, share a concurrent connect and disconnect idempotently, identically (`core/db/database-connection.contract.spec.ts` — T01) |
| owner-auth.CT06 | `IMailSender` | `GmailMailSender` (against a local SMTP test server), `DisabledMailSender` and `RecordingMailSender` accept the same message; provider failures surface as `UpstreamError` |

## Data variations
- Passwords: 1 character, 200 characters, 201 characters (400), unicode, leading/trailing spaces (not trimmed). Reset `newPassword`: 11 characters (400), 12 characters (200).
- Emails: malformed (400), 255 characters (400).
- Codes: 5 digits, 7 digits, letters (400 `VALIDATION_FAILED`); `000000` is a valid code.
- References: empty, 101 characters (400); a well-formed bcrypt string never issued (`OTP_INVALID`).
