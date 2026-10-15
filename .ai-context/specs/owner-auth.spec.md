# Spec: Owner Authentication
## Spec ID
owner-auth
## Status
Draft
## Linked BRD
.ai-context/BRD.md#BRD-002
## Intent
Let the single owner sign in to the CMS with email and password and stay signed in through a
short-lived access cookie and a rotating refresh cookie, and give every `/api/v1/cms/**` route
one guard that rejects everyone else. There is no sign-up: the owner account is created by a
seeder from environment variables.
## Context
- Builds on: .ai-context/architecture.md (API modules → `auth`, Request lifecycle)
- Related: .ai-context/specs/monorepo-foundation.spec.md, .ai-context/specs/cms-panel-shell.spec.md (login screen)
- Shared facts used: .ai-context/ownership_index.md (Response envelope and canonical error codes ·
  Environment variables)
## Session contract
Canonical owner of these facts (`ownership_index.md`).
| Item | Value |
|---|---|
| Access cookie | `pb_access` — signed JWT (`sub` = user id), 15 min, `HttpOnly`, `SameSite=Strict`, `Path=/api/v1`, `Secure` in production |
| Refresh cookie | `pb_refresh` — opaque 256-bit random value, 7 days, `HttpOnly`, `SameSite=Strict`, `Path=/api/v1/auth`, `Secure` in production |
| Refresh storage | Only the SHA-256 hash is stored, in `auth_sessions`, with a `familyId` |
| Guard | `requireOwner` middleware verifies `pb_access` and sets `req.auth = { userId }`; failure → 401 `UNAUTHENTICATED` |
| Origin allow-list | Every non-GET request under `/api/v1/auth` and `/api/v1/cms` must send `Origin` equal to `WEB_ORIGIN`; otherwise 403 `ORIGIN_NOT_ALLOWED` |
| Password hashing | argon2id through `IPasswordHasher` |
Tokens are never returned in a response body and never stored in browser storage.
## API Contract
### owner-auth.API01 — POST /api/v1/auth/login
**Request payload:**
```json
{ "email": "string (email, ≤ 254)", "password": "string (1..200)" }
```
**Success response (200):** sets both cookies.
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
**Request payload:** none (reads `pb_refresh`).
**Success response (200):** rotates the refresh token, sets both cookies, `data: { "user": { … } }`.
**Exceptions:**
| Code | Condition | Response body |
|---|---|---|
| 401 | Cookie missing, unknown, expired or revoked | `UNAUTHENTICATED` (both cookies cleared) |
| 401 | A token that was already rotated is presented again | `UNAUTHENTICATED`; the whole session family is revoked |
| 403 | `Origin` not allowed | `ORIGIN_NOT_ALLOWED` |
### owner-auth.API03 — POST /api/v1/auth/logout
**Request payload:** none.
**Success response (200):** revokes the current session if one exists, clears both cookies. Idempotent — also 200 with no cookies.
**Exceptions:**
| Code | Condition | Response body |
|---|---|---|
| 403 | `Origin` not allowed | `ORIGIN_NOT_ALLOWED` |
### owner-auth.API04 — GET /api/v1/auth/me
**Success response (200):** `data: { "user": { "id", "email", "displayName" } }`
**Exceptions:**
| Code | Condition | Response body |
|---|---|---|
| 401 | No valid `pb_access` | `UNAUTHENTICATED` |
## Acceptance Criteria
1. owner-auth.AC1 — Given the seeded owner, when API01 is called with the correct email and
   password, then the response is 200, both cookies are set with the attributes in the session
   contract, and no token appears in the body.
2. owner-auth.AC2 — Given the seeded owner, when API01 is called with a wrong password, or with
   an email that does not exist, then both return 401 with an identical body, and password
   verification work is performed in both cases.
3. owner-auth.AC3 — Given 5 failed logins for one IP + email within 15 minutes, when a sixth
   attempt is made — even with the correct password — then the response is 429 with
   `Retry-After`.
4. owner-auth.AC4 — Given a valid `pb_refresh`, when API02 is called, then a new refresh token
   replaces the old one, the old one is marked rotated, and a new `pb_access` is issued.
5. owner-auth.AC5 — Given a refresh token that has already been rotated, when it is presented
   to API02, then the response is 401 and every session in that family is revoked, so the newer
   token stops working too.
6. owner-auth.AC6 — Given a signed-in owner, when API03 is called, then the session is revoked,
   both cookies are cleared, and a later API02 call with the old cookie returns 401.
7. owner-auth.AC7 — Given any route under `/api/v1/cms`, when it is requested without a valid
   `pb_access` (absent, expired, tampered, signed with another secret), then the response is 401
   `UNAUTHENTICATED` and the controller is not invoked.
8. owner-auth.AC8 — Given a non-GET request under `/api/v1/auth` or `/api/v1/cms` whose `Origin`
   header is missing or differs from `WEB_ORIGIN`, when it is received, then the response is 403
   `ORIGIN_NOT_ALLOWED` before authentication is evaluated.
9. owner-auth.AC9 — Given an empty `users` collection and `OWNER_EMAIL` / `OWNER_PASSWORD` set,
   when the owner seeder runs, then exactly one user exists with an argon2id hash; when it runs
   again, then nothing changes and the stored hash is untouched.
10. owner-auth.AC10 — Given `OWNER_PASSWORD` shorter than 12 characters, when the owner seeder
    runs, then it fails with a message that does not echo the password, and creates no user.
11. owner-auth.AC11 — Given any auth request, when it is logged, then the log line contains no
    password, cookie value, token or email address.
## Edge Cases Covered
- Email compared case-insensitively; stored lower-cased.
- Expired refresh sessions are removed by a TTL index; an expired cookie → 401.
- Two tabs refreshing at once: the second presents an already-rotated token. To avoid logging
  the owner out on a benign race, a rotated token is accepted for a 10-second grace window and
  returns the already-issued successor; outside the window AC5 applies.
- Clock skew: access-token expiry is checked with a 30-second leeway.
- Logout with a malformed cookie still returns 200 and clears cookies.
## Error Handling
- All credential failures collapse to one 401 body — no user enumeration.
- Hashing or token-signing failures → 500 `INTERNAL_ERROR`; nothing about the cause is returned.
- Rate-limit counters are in process memory (see `monorepo-foundation`); a restart resets them.
## Unit Test Cases (spec-derived)
| Test ID | Maps to AC | Scenario | Expected |
|---|---|---|---|
| owner-auth.UT01 | AC1 | `AuthService.login` with correct credentials (fake repos, fake hasher) | Returns user + token pair; a session is saved with a hashed token |
| owner-auth.UT02 | AC2 | Login with unknown email | Throws unauthenticated; hasher `verify` was still called once |
| owner-auth.UT03 | AC2 | Login with wrong password | Throws the same error as UT02 |
| owner-auth.UT04 | AC4 | `refresh` with a valid token | Old session marked rotated; new session in the same family |
| owner-auth.UT05 | AC5 | `refresh` with a rotated token outside the grace window | Throws; `revokeFamily` called |
| owner-auth.UT06 | Edge | `refresh` with a rotated token inside the grace window | Returns the successor; nothing revoked |
| owner-auth.UT07 | AC6 | `logout` with and without a session | Session revoked / no error |
| owner-auth.UT08 | AC7 | `requireOwner` with expired, tampered and wrong-secret tokens | 401 each; `next` not called |
| owner-auth.UT09 | AC10 | Seeder with an 11-character password | Throws; message has no password; repo `create` not called |
## Explicitly Out of Scope
- Sign-up, invitations, multiple users, roles.
- Password reset by email; two-factor authentication (BRD-002, open).
- OAuth / social login.
- The login screen itself — `cms-panel-shell`.
## Non-Functional Constraints (from constitution.md)
- `users` is the only authentication source; no AI provider is involved.
- Test-first: every endpoint and the guard.
- No latency target defined yet for auth routes; argon2 cost parameters are chosen at
  implementation and recorded in the plan once measured.
