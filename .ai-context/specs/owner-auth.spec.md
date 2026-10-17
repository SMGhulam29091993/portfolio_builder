# Spec: Owner Authentication
## Spec ID
owner-auth
## Status
In Progress
- DoR self-check: 2026-10-17, pass. Moved `Draft → Ready` by the owner on 2026-10-17 ("start"),
  then `Ready → In Progress` with `owner-auth.T01` started the same day.
- Revised 2026-10-17 to the owner's session and password-reset design, before the spec was ever
  `Ready` (no `⚠️ REVISED` marker is needed): JWT access token plus `jti` held in a Redis
  session (ADR-0008), strictly one session, OTP password reset by email (ADR-0009).
## Linked BRD
.ai-context/BRD.md#BRD-002
## Intent
Let the single owner sign in to the CMS with email and password, stay signed in through three
`HttpOnly` cookies (a 15-minute JWT access token, a 7-day refresh token and the session's `jti`)
backed by exactly one session record in Redis, and give every `/api/v1/cms/**` route one guard
that rejects everyone else and tells a superseded browser that its session has ended. When the
password is forgotten, the owner resets it with a 6-digit one-time code sent by email. There is
no sign-up: the owner account is created by a seeder from environment variables.
## Context
- Builds on: .ai-context/architecture.md (API modules → `auth`, Request lifecycle),
  .ai-context/decisions/ADR-0008-redis-session-store.md,
  .ai-context/decisions/ADR-0009-mail-delivery.md
- Related: .ai-context/specs/monorepo-foundation.spec.md, .ai-context/specs/cms-panel-shell.spec.md
  (login and password-reset screens)
- Shared facts used: .ai-context/ownership_index.md (Response envelope and canonical error codes ·
  Environment variables)
## Session contract
Canonical owner of these facts (`ownership_index.md`).
| Item | Value |
|---|---|
| Access token | JWT, HS256, signed with `JWT_ACCESS_SECRET`. Claims: `sub` (user id), `jti`, `iat`, `exp` = `iat` + 15 min. No email, name or other personal data |
| `access-token` cookie | The access JWT. `HttpOnly`, `Path=/api/v1`, `Max-Age` 7 days — longer than the JWT so that refresh can still read an expired token |
| `refresh-token` cookie | Opaque 256-bit random value (base64url). `HttpOnly`, `Path=/api/v1/auth`, `Max-Age` 7 days |
| `jti` cookie | The session's `jti` (128-bit random, base64url). `HttpOnly`, `Path=/api/v1`, `Max-Age` 7 days |
| Cookie flags | All three: `Secure` and `SameSite=Strict` when `NODE_ENV=production`; otherwise no `Secure` and `SameSite=Lax`. Read from the injected `env`, never `process.env` |
| Session store | Redis, **one session per user**: key `auth:session:<userId>` → `{ jti, refreshTokenHash, issuedAt }`, TTL 7 days, reset on every refresh. `refreshTokenHash` is the SHA-256 of the refresh token; the raw token is never stored. A login replaces any existing session, which ends it everywhere else |
| Guard | `requireOwner` — see *Request authorization* |
| Origin allow-list | Every non-GET request under `/api/v1/auth` and `/api/v1/cms` must send `Origin` equal to `WEB_ORIGIN`; otherwise 403 `ORIGIN_NOT_ALLOWED` |
| Password hashing | argon2id through `IPasswordHasher` (ADR-0007) |

Tokens are never returned in a response body and never written to browser storage; the web app
keeps only the `user` object in client state.
## Request authorization (`requireOwner`)
Runs on every `/api/v1/cms/**` route, in this order. The first failing step ends the request and
the controller is not invoked.
1. Verify the `access-token` cookie: signature with `JWT_ACCESS_SECRET` and expiry with a
   30-second leeway. Absent, malformed, expired, tampered or signed with another secret → 401
   `UNAUTHENTICATED`.
2. Load the session `auth:session:<sub>`. None → 401 `UNAUTHENTICATED`.
3. Compare the token's `jti`, the `jti` cookie and the session's `jti`. All three must be equal;
   any mismatch → 401 `SESSION_EXPIRED`, and all three cookies are cleared. The session itself is
   left in place: it belongs to the newer sign-in that superseded this browser.
4. Set `req.auth = { userId: sub }` and continue.
The `refresh-token` cookie is scoped to `/api/v1/auth`, so it never reaches `/cms` routes; step 2
is the check against the stored session that the refresh token belongs to.
## Refresh (`owner-auth.API02`)
Same checks as the guard, except that the access token's expiry is ignored, plus the refresh
token itself:
1. Verify the `access-token` cookie's signature (expiry ignored). Absent or invalid → 401
   `UNAUTHENTICATED`.
2. Load the session for `sub`. None → 401 `UNAUTHENTICATED`.
3. Triple `jti` match as in the guard. Mismatch → 401 `SESSION_EXPIRED`, cookies cleared,
   session left in place.
4. SHA-256 of the `refresh-token` cookie equals `refreshTokenHash`. Absent or different → 401
   `UNAUTHENTICATED`, cookies cleared and **the session is deleted**: a valid `jti` with a wrong
   refresh token means a cookie was forged or stolen.
5. Mint a new `jti`, access token and refresh token, and replace the session with a
   compare-and-set on the presented `jti` (a single atomic Redis operation). If the stored `jti`
   changed in the meantime, the call fails as in step 3. Set all three cookies; respond 200.
There is no grace window (owner, 2026-10-17): of two refreshes sent with the same cookies,
exactly one succeeds and the other receives `SESSION_EXPIRED`. The web client avoids this by
serialising refreshes across tabs (`cms-panel-shell`).
## Password reset by one-time code
Purpose `password_reset` is the only purpose today; the `purpose` field exists so a code issued
for one action can never complete another.
| Item | Value |
|---|---|
| Code | 6 digits from `crypto.randomInt(0, 1_000_000)`, zero-padded |
| Identifier | 32 random bytes from `crypto.randomBytes`, hex (64 characters); stored as-is in the `otps` document |
| Reference | `bcrypt(identifier)`; returned to the client, which sends it back with the code. Never stored in MongoDB |
| Redis | `auth:otp-ref:<reference>` → identifier, TTL 24 hours |
| MongoDB `otps` | One document per `(userId, purpose)`, written by **upsert**: `userId`, `purpose`, `identifier` (unique), `otpHash` = `bcrypt(code)`, `attempts`, `sentAt`, `expiresAt` = `sentAt` + 10 min, `purgeAt` = `sentAt` + 24 h (TTL index) |
| Hashing | bcrypt, cost 10 (ADR-0007) |
| Expiry | 10 minutes. An expired code's document stays until a resend replaces it or `purgeAt` removes it |
| Attempts | 5 wrong codes and the code is dead; the next resend issues a fresh one |
| Resend cooldown | 60 seconds since `sentAt` |
| Send limit | API05 and API06 together: 5 sends per hour per IP, through `RateLimiterFactory` |

Lookup on verify: reference → Redis → identifier → `otps` by identifier → `bcrypt.compare(code,
otpHash)`. A successful reset deletes the `otps` document and the Redis reference, sets the new
password and deletes the auth session, so every browser must sign in again.
## Mail delivery
Canonical rules are in ADR-0009. `auth` depends on `IMailSender` (`send({ to, subject, text })`).
`MailSenderFactory` picks the first configured strategy in priority order; today the only one is
`GmailMailSender` (nodemailer over Gmail SMTP with `GMAIL_USER` / `GMAIL_APP_PASSWORD`). A later
provider such as Brevo is one new class and one factory registration, ahead of Gmail in the
order. In production, startup fails when no strategy is configured. Outside production with none
configured, `DisabledMailSender` is used: API05 and API06 answer 503 `SERVICE_UNAVAILABLE` and
sign-in still works. The message is plain text — the code and its 10-minute expiry, no link — and
the code is never logged.
## API Contract
### owner-auth.API01 — POST /api/v1/auth/login
**Request payload:**
```json
{ "email": "string (email, ≤ 254)", "password": "string (1..200)" }
```
**Success response (200):** creates the session (replacing any existing one) and sets all three
cookies.
```json
{ "success": true, "message": "Signed in",
  "data": { "user": { "id": "string", "email": "string", "displayName": "string" } } }
```
**Exceptions:**
| Code | Condition | Response body |
|---|---|---|
| 400 | Body fails the schema | `VALIDATION_FAILED` |
| 401 | Unknown email **or** wrong password (same message for both) | `UNAUTHENTICATED` |
| 403 | `Origin` not allowed | `ORIGIN_NOT_ALLOWED` |
| 429 | More than 5 failed attempts in 15 minutes for the same IP + email | `RATE_LIMITED` |
### owner-auth.API02 — POST /api/v1/auth/refresh
**Request payload:** none (reads the three cookies).
**Success response (200):** rotates `jti`, access token and refresh token (see *Refresh*), sets
all three cookies, `data: { "user": { … } }`.
**Exceptions:**
| Code | Condition | Response body |
|---|---|---|
| 401 | Access cookie absent or its signature invalid; no session for `sub` | `UNAUTHENTICATED` (cookies cleared) |
| 401 | `jti` mismatch between token, cookie and session | `SESSION_EXPIRED` (cookies cleared; session kept) |
| 401 | Refresh token absent or its hash differs, with a matching `jti` | `UNAUTHENTICATED` (cookies cleared; session deleted) |
| 403 | `Origin` not allowed | `ORIGIN_NOT_ALLOWED` |
### owner-auth.API03 — POST /api/v1/auth/logout
**Request payload:** none.
**Success response (200):** if the access cookie's signature is valid (expiry ignored) and its
`jti` matches the stored session, deletes that session; always clears all three cookies.
Idempotent — also 200 with no or malformed cookies. A superseded browser cannot end the newer
session.
**Exceptions:**
| Code | Condition | Response body |
|---|---|---|
| 403 | `Origin` not allowed | `ORIGIN_NOT_ALLOWED` |
### owner-auth.API04 — GET /api/v1/auth/me
Guarded by `requireOwner`.
**Success response (200):** `data: { "user": { "id", "email", "displayName" } }`
**Exceptions:**
| Code | Condition | Response body |
|---|---|---|
| 401 | Guard steps 1–2 fail | `UNAUTHENTICATED` |
| 401 | Guard step 3 fails | `SESSION_EXPIRED` |
### owner-auth.API05 — POST /api/v1/auth/password/forgot
**Request payload:**
```json
{ "email": "string (email, ≤ 254)" }
```
**Success response (200):** the same shape whether or not the email belongs to the owner. For the
owner: issues a code (upsert), stores the reference in Redis and sends the email. For any other
address: returns a decoy reference produced the same way, writes nothing and sends nothing.
```json
{ "success": true, "message": "If the address is registered, a code has been sent",
  "data": { "reference": "string", "expiresInSec": 600 } }
```
**Exceptions:**
| Code | Condition | Response body |
|---|---|---|
| 400 | Body fails the schema | `VALIDATION_FAILED` |
| 403 | `Origin` not allowed | `ORIGIN_NOT_ALLOWED` |
| 429 | Send limit reached for the IP | `RATE_LIMITED` |
| 502 | The mail provider rejected the send | `UPSTREAM_FAILED` (`provider: "mail"`) |
| 503 | No mail strategy configured (non-production only) | `SERVICE_UNAVAILABLE` |
### owner-auth.API06 — POST /api/v1/auth/password/resend
**Request payload:**
```json
{ "reference": "string (1..100)" }
```
**Success response (200):** issues a new code, identifier and reference; updates the `otps`
document (code hash, identifier, `attempts` = 0, `sentAt`, `expiresAt`, `purgeAt`); deletes the
old Redis reference and stores the new one; sends the email. `data: { "reference", "expiresInSec": 600 }`.
**Exceptions:**
| Code | Condition | Response body |
|---|---|---|
| 400 | Body fails the schema; the reference resolves to nothing | `VALIDATION_FAILED` / `OTP_INVALID` |
| 403 | `Origin` not allowed | `ORIGIN_NOT_ALLOWED` |
| 429 | Less than 60 s since `sentAt`, or the send limit reached | `RATE_LIMITED` |
| 502 | The mail provider rejected the send | `UPSTREAM_FAILED` (`provider: "mail"`) |
| 503 | No mail strategy configured (non-production only) | `SERVICE_UNAVAILABLE` |
### owner-auth.API07 — POST /api/v1/auth/password/reset
**Request payload:**
```json
{ "reference": "string (1..100)", "otp": "string (exactly 6 digits)", "newPassword": "string (12..200)" }
```
**Success response (200):** sets the new argon2id password hash, deletes the `otps` document, the
Redis reference and the auth session, clears all three cookies. `message: "Password updated"`, no `data`.
**Exceptions:**
| Code | Condition | Response body |
|---|---|---|
| 400 | Body fails the schema | `VALIDATION_FAILED` |
| 400 | Reference resolves to nothing; no `otps` document; 5 attempts used; wrong code | `OTP_INVALID` (one body for all four) |
| 400 | The code's `expiresAt` has passed | `OTP_EXPIRED` |
| 403 | `Origin` not allowed | `ORIGIN_NOT_ALLOWED` |
## Acceptance Criteria
1. owner-auth.AC1 — Given the seeded owner, when API01 is called with the correct email and
   password, then the response is 200, the `access-token`, `refresh-token` and `jti` cookies are
   set with the attributes in the session contract, no token appears in the body, and
   `auth:session:<userId>` holds the cookie's `jti` and the SHA-256 of the refresh token.
2. owner-auth.AC2 — Given the seeded owner, when API01 is called with a wrong password, or with
   an email that does not exist, then both return 401 with an identical body, and password
   verification work is performed in both cases.
3. owner-auth.AC3 — Given 5 failed logins for one IP + email within 15 minutes, when a sixth
   attempt is made — even with the correct password — then the response is 429 with
   `Retry-After`.
4. owner-auth.AC4 — Given a signed-in owner, when a `/api/v1/cms` route is requested with the
   three cookies, then the controller runs with `req.auth.userId` equal to the owner's id.
5. owner-auth.AC5 — Given any `/api/v1/cms` route, when the `access-token` cookie is absent,
   expired, tampered or signed with another secret, or when no session exists for its `sub`,
   then the response is 401 `UNAUTHENTICATED` and the controller is not invoked.
6. owner-auth.AC6 — Given a valid access token, when its `jti`, the `jti` cookie and the stored
   session's `jti` are not all equal, then the response is 401 `SESSION_EXPIRED`, all three
   cookies are cleared, the stored session is unchanged and the controller is not invoked.
7. owner-auth.AC7 — Given the owner signed in on browser A, when they sign in on browser B, then
   A's next `/api/v1/cms` request returns 401 `SESSION_EXPIRED` and B's succeeds.
8. owner-auth.AC8 — Given a signed-in owner whose access token has expired, when API02 is called
   with the three cookies, then the response is 200, all three values are new, the session holds
   the new `jti` and refresh hash with a fresh 7-day TTL, and replaying the old cookies returns
   401 `SESSION_EXPIRED`.
9. owner-auth.AC9 — Given matching `jti` values, when API02 is called with an absent or wrong
   `refresh-token` cookie, then the response is 401 `UNAUTHENTICATED` and the session is deleted,
   so the genuine cookies stop working too.
10. owner-auth.AC10 — Given two API02 calls sent at the same time with the same cookies, then
    exactly one returns 200 and the other returns 401 `SESSION_EXPIRED`.
11. owner-auth.AC11 — Given a signed-in owner, when API03 is called, then the session is deleted,
    all three cookies are cleared, and a later API02 with the old cookies returns 401
    `UNAUTHENTICATED`; given a superseded browser (AC7), when it calls API03, then the newer
    session is not deleted.
12. owner-auth.AC12 — Given a non-GET request under `/api/v1/auth` or `/api/v1/cms` whose `Origin`
    header is missing or differs from `WEB_ORIGIN`, when it is received, then the response is 403
    `ORIGIN_NOT_ALLOWED` before authentication is evaluated.
13. owner-auth.AC13 — Given an empty `users` collection and `OWNER_EMAIL` / `OWNER_PASSWORD` set,
    when the owner seeder runs, then exactly one user exists with an argon2id hash; when it runs
    again, then nothing changes and the stored hash is untouched.
14. owner-auth.AC14 — Given `OWNER_PASSWORD` shorter than 12 characters, when the owner seeder
    runs, then it fails with a message that does not echo the password, and creates no user.
15. owner-auth.AC15 — Given any auth request, when it is logged, then the log line contains no
    password, cookie value, token, `jti`, one-time code, identifier, reference or email address.
16. owner-auth.AC16 — Given the owner's email, when API05 is called, then the response is 200 with
    a `reference` and no code; one `otps` document exists for `(userId, "password_reset")` whose
    `otpHash` is a bcrypt hash of the emailed code and whose `expiresAt` is 10 minutes after
    `sentAt`; `auth:otp-ref:<reference>` holds the document's identifier; and exactly one email
    containing a 6-digit code was sent to the owner.
17. owner-auth.AC17 — Given an email that is not the owner's, when API05 is called, then the
    response has the same status and shape as AC16, and no document, Redis key or email is
    created.
18. owner-auth.AC18 — Given a valid reference and the emailed code within 10 minutes, when API07
    is called with a new password of 12+ characters, then the response is 200; the old password
    fails API01 and the new one succeeds; the `otps` document and the Redis reference are gone;
    the previous session's cookies return `UNAUTHENTICATED`; and the same reference sent again
    returns 400 `OTP_INVALID`.
19. owner-auth.AC19 — Given a valid reference, when API07 is called with a wrong code, then the
    response is 400 `OTP_INVALID` and `attempts` increases by one; after the fifth wrong code,
    the correct code also returns `OTP_INVALID`.
20. owner-auth.AC20 — Given a code whose `expiresAt` has passed, when API07 is called with it,
    then the response is 400 `OTP_EXPIRED` and the `otps` document is still present.
21. owner-auth.AC21 — Given a code sent more than 60 seconds ago, when API06 is called with its
    reference, then a new code and a new reference are issued, `attempts` is 0, the old reference
    returns `OTP_INVALID` and the old code no longer verifies; given less than 60 seconds, then
    the response is 429 with `Retry-After`.
22. owner-auth.AC22 — Given `NODE_ENV=production` and no mail strategy configured, when the API
    starts, then startup fails naming the missing variables; given a non-production environment
    and no strategy, then API05 returns 503 `SERVICE_UNAVAILABLE` and API01 still works.
## Edge Cases Covered
- Email compared case-insensitively; stored lower-cased (login and forgot).
- An expired or missing Redis session → 401 `UNAUTHENTICATED`; the 7-day TTL removes idle
  sessions with no sweeper.
- Sessions slide: every refresh resets the 7-day TTL. There is no absolute session cap.
- Two tabs share one set of cookies. A refresh in one tab updates the cookies the other tab
  sends, so only refreshes issued at the same moment collide (AC10); `cms-panel-shell`
  serialises them across tabs.
- Clock skew: access-token expiry is checked with a 30-second leeway.
- Logout with a malformed cookie still returns 200 and clears cookies.
- A second API05 for the owner before the first code is used replaces it (upsert); the earlier
  reference then resolves to an identifier no document holds → `OTP_INVALID`.
- The Redis reference outlives the code (24 hours vs 10 minutes), so an expired code can still be
  resent by reference. After 24 hours both the Redis key and the document are gone; the owner
  starts again from API05.
- A reset while the owner is signed in elsewhere signs that browser out (AC18).
- Redis unreachable at runtime → 503 `SERVICE_UNAVAILABLE` from the guard and every auth route;
  nothing falls back to "allow".
## Error Handling
- All credential failures collapse to one 401 `UNAUTHENTICATED` body — no user enumeration.
  `SESSION_EXPIRED` is returned only after the access token's signature has been verified, so it
  reveals nothing to a caller without a genuine token.
- API05 answers identically for known and unknown addresses. The owner's email is public on the
  portfolio, so this is defence in depth; a mail-provider failure (502) is the one difference
  that remains.
- One `OTP_INVALID` body covers an unknown reference, a missing document, exhausted attempts and
  a wrong code. `OTP_EXPIRED` is distinct so the screen can offer a resend; only a caller holding
  a real reference can reach it.
- Hashing, signing, Redis or mail failures → 500 `INTERNAL_ERROR`, 503 or 502 as listed; nothing
  about the cause is returned.
- Login and send rate-limit counters are in process memory (`RateLimiterFactory`); a restart
  resets them. The resend cooldown is enforced from `sentAt` in MongoDB and survives restarts.
## Unit Test Cases (spec-derived)
| Test ID | Maps to AC | Scenario | Expected |
|---|---|---|---|
| owner-auth.UT01 | AC1 | `AuthService.login` with correct credentials (fakes) | Returns user + token set; session saved with the `jti` and a SHA-256 refresh hash, replacing any previous one |
| owner-auth.UT02 | AC2 | Login with unknown email | Throws unauthenticated; hasher `verify` was still called once |
| owner-auth.UT03 | AC2 | Login with wrong password | Throws the same error as UT02 |
| owner-auth.UT04 | AC4, AC5 | `SessionAuthorizer.authorize` with a valid token and session; with no session | Returns `userId`; throws unauthenticated |
| owner-auth.UT05 | AC6 | `authorize` with token `jti` ≠ cookie `jti`, and with cookie = token ≠ session | Throws session-expired each; session store untouched |
| owner-auth.UT06 | AC8 | `refresh` with an expired token and matching cookies | New `jti`, access and refresh; compare-and-set called with the old `jti` |
| owner-auth.UT07 | AC9 | `refresh` with matching `jti` and a wrong refresh token | Throws unauthenticated; session deleted |
| owner-auth.UT08 | AC10 | `refresh` when compare-and-set reports the `jti` changed | Throws session-expired; nothing deleted |
| owner-auth.UT09 | AC11 | `logout` with the current session, a superseded one, and no cookies | Deleted / untouched / no error |
| owner-auth.UT10 | AC5 | `requireOwner` with expired, tampered and wrong-secret tokens | 401 each; `next` not called |
| owner-auth.UT11 | AC14 | Seeder with an 11-character password | Throws; message has no password; repo `create` not called |
| owner-auth.UT12 | AC16 | `PasswordResetService.requestCode` for the owner (fakes, fixed random source) | Upsert with bcrypt code hash, raw identifier, expiry +10 min; Redis ref → identifier; one mail with the code |
| owner-auth.UT13 | AC17 | `requestCode` for an unknown email | Same result shape; no upsert, no Redis write, no mail |
| owner-auth.UT14 | AC18 | `reset` with the right code in time | Password hash set; document, reference and session deleted |
| owner-auth.UT15 | AC19 | `reset` with a wrong code, then after 5 attempts with the right one | `OTP_INVALID` and `attempts` +1; then `OTP_INVALID` without a compare |
| owner-auth.UT16 | AC20 | `reset` after `expiresAt` | `OTP_EXPIRED`; nothing deleted |
| owner-auth.UT17 | AC21 | `resend` at 59 s and at 61 s | Throws rate-limited; then new code, identifier and reference, old reference deleted |
| owner-auth.UT18 | AC22 | `MailSenderFactory` with Gmail configured; with nothing in production; with nothing outside production | Gmail sender; throws; disabled sender |
## Explicitly Out of Scope
- Sign-up, invitations, multiple users, roles.
- More than one concurrent session; a list of devices; "sign out everywhere" as its own endpoint
  (a password reset does it).
- Changing the password while signed in.
- Two-factor authentication at sign-in (BRD-002, open).
- Mail strategies other than Gmail; Brevo is anticipated by the factory but not built here.
- OAuth / social login.
- The login and password-reset screens themselves — `cms-panel-shell`.
## Non-Functional Constraints (from constitution.md)
- `users` is the only authentication source; no AI provider or mail provider is an identity path.
- Test-first: every endpoint, the guard and the password-reset flow.
- Redis-backed stores are tested against a real Redis server, as MongoDB repositories are
  against a real `mongod` (ADR-0008).
- No latency target defined yet for auth routes; argon2 cost parameters are chosen at
  implementation and recorded in the plan once measured.
