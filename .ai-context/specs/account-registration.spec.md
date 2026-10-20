# Spec: Account Registration
## Spec ID
account-registration
## Status
In Progress
- `Ready → In Progress` on 2026-10-20 with `account-registration.T01` started.
- DoR self-check: 2026-10-20, pass. Moved `Draft → Ready` by the agent under the owner's
  standing authorisation of 2026-10-20 (`governance.md`).
- Written 2026-10-20 from ADR-0010 (decision and its owner answers of 2026-10-20) and BRD-009.
## Linked BRD
.ai-context/BRD.md#BRD-009
## Intent
Let anyone create an account with an email, a password and a display name, and require them to
prove the email with a 6-digit code before the account can sign in. Exactly one account, ever,
is the platform owner: it is the account registered with the correct owner secret key while no
owner exists. After that the key is refused for good, and a public read tells the registration
form whether to offer the field at all. Every other account is a `member`. Verifying the email
signs the new user in. Registration never reveals whether an email is already registered.
## Context
- Builds on: .ai-context/specs/owner-auth.spec.md (users, the session, the one-time-code
  machinery, the code-send limiter, the mail port), .ai-context/decisions/ADR-0010-multi-tenant-accounts.md
- Related: .ai-context/specs/cms-panel-shell.spec.md (the registration and verification
  screens), .ai-context/specs/google-sign-in.spec.md (accounts created by Google are verified
  members), `platform-admin` (what the owner role may do; suspension)
- Shared facts used: .ai-context/ownership_index.md (Response envelope and canonical error codes
  · Session contract · One-time-code contract · Environment variables)
## Roles and the owner claim
| Item | Value |
|---|---|
| `users.role` | `owner` or `member`; every account has one. Absent on documents written before this spec, which read as `member` |
| One owner | A unique partial index on `{ role: 1 }` where `role = "owner"`; the database rejects a second owner when two claims race |
| Owner secret | `OWNER_REGISTRATION_SECRET` (optional; 32–200 characters when set). Compared in constant time on the SHA-256 of both values; never logged, never stored |
| Claim open | No owner exists **and** the secret is configured. Otherwise the claim is closed |
| Claim with the field | `ownerSecret` present and non-empty: when the claim is closed or the value differs → 403 `OWNER_CLAIM_REFUSED`, nothing written or sent; when it matches → the account is created with `role: "owner"` |
| Claim without the field | `ownerSecret` absent or empty → `member` |
| Owner via Google | Never (ADR-0011 → Owner answer) |
## Email verification
- `users.emailVerifiedAt` is set once, when the account's email is proved. An account without
  it cannot sign in: `owner-auth.API01` answers 403 `EMAIL_NOT_VERIFIED` after a correct
  password (a wrong password is the usual 401, so the 403 tells only the password holder).
- The code follows the one-time-code contract of `owner-auth` (6 digits, bcrypt, 10-minute
  expiry, 5 attempts, 60-second resend cooldown, reference held in Redis for 24 hours) with the
  purpose `email_verification`. A code for one purpose never completes the other.
- A completed password reset (`owner-auth.API07`) also sets `emailVerifiedAt` when it is unset:
  the code reached that address.
## API Contract
All five routes sit under `/api/v1/auth`; the non-GET ones are behind the Origin allow-list,
and the three that send a code share the code-send limiter of `owner-auth.API05`/`API06`
(5 sends per hour per IP across all five send routes).
### account-registration.API01 — GET /api/v1/auth/registration/options
**Success response (200):** `data: { "ownerClaimOpen": boolean }`
**Exceptions:** none beyond the global 500.
### account-registration.API02 — POST /api/v1/auth/register
**Request payload:**
```json
{ "email": "string (email, ≤ 254)", "password": "string (12..200)",
  "displayName": "string (plain text, 1..80)", "ownerSecret": "string (≤ 200), optional" }
```
**Success response (200):** the same message and shape for every outcome below.
- New email: creates the account (unverified, role per the claim), issues a code, sends it.
- An existing **unverified** account: replaces its password hash and display name (and makes it
  the owner when the claim matches), issues a fresh code, sends it.
- An existing **verified** account: a decoy reference made the same way; nothing written or sent.
```json
{ "success": true, "message": "Check your email for a verification code",
  "data": { "reference": "string", "expiresInSec": 600 } }
```
**Exceptions:**
| Code | Condition | Response body |
|---|---|---|
| 400 | Body fails the schema | `VALIDATION_FAILED` |
| 403 | `Origin` not allowed | `ORIGIN_NOT_ALLOWED` |
| 403 | `ownerSecret` given and the claim is closed or the value differs | `OWNER_CLAIM_REFUSED` |
| 409 | The owner claim lost a race to another claim | `OWNER_EXISTS` |
| 429 | Send limit reached for the IP | `RATE_LIMITED` |
| 502 | The mail provider rejected the send | `UPSTREAM_FAILED` (`provider: "mail"`) |
| 503 | No mail strategy configured (non-production only) | `SERVICE_UNAVAILABLE` |
### account-registration.API03 — POST /api/v1/auth/register/verify
**Request payload:** `{ "reference": "string (1..100)", "otp": "string (exactly 6 digits)" }`
**Success response (200):** sets `emailVerifiedAt`, deletes the code and its reference, starts
the user's session exactly as `owner-auth.API01` does (three cookies, replacing any session),
`message: "Email verified"`, `data: { "user": { "id", "email", "displayName", "role" } }`.
**Exceptions:**
| Code | Condition | Response body |
|---|---|---|
| 400 | Body fails the schema | `VALIDATION_FAILED` |
| 400 | Unknown reference; no document; 5 attempts used; wrong code | `OTP_INVALID` |
| 400 | The code has expired | `OTP_EXPIRED` |
| 403 | `Origin` not allowed | `ORIGIN_NOT_ALLOWED` |
### account-registration.API04 — POST /api/v1/auth/verification/request
For a user who lost the reference. **Request payload:** `{ "email": "string (email, ≤ 254)" }`
**Success response (200):** the same shape for every address: for an unverified account a code
is issued and sent; for an unknown or already-verified address a decoy reference is returned
and nothing is written or sent. `message: "If the address needs verifying, a code has been sent"`,
`data: { "reference", "expiresInSec": 600 }`.
**Exceptions:** 400 `VALIDATION_FAILED`, 403 `ORIGIN_NOT_ALLOWED`, 429 `RATE_LIMITED`, 502
`UPSTREAM_FAILED`, 503 `SERVICE_UNAVAILABLE` — as API02.
### account-registration.API05 — POST /api/v1/auth/verification/resend
**Request payload:** `{ "reference": "string (1..100)" }`
**Success response (200):** a fresh code, identifier and reference for the same account; the old
reference and code stop working. `data: { "reference", "expiresInSec": 600 }`.
**Exceptions:**
| Code | Condition | Response body |
|---|---|---|
| 400 | Body fails the schema; reference resolves to no verification code | `VALIDATION_FAILED` / `OTP_INVALID` |
| 403 | `Origin` not allowed | `ORIGIN_NOT_ALLOWED` |
| 429 | Less than 60 s since the last send, or the send limit reached | `RATE_LIMITED` |
| 502 / 503 | As API02 | `UPSTREAM_FAILED` / `SERVICE_UNAVAILABLE` |
### Changes to `owner-auth` routes
- `owner-auth.API01`: 403 `EMAIL_NOT_VERIFIED` when the password is right and the email is not
  verified. No session is created and no cookie is set.
- `owner-auth.API01`, `API02`, `API04` and API03 above: `user` gains `role` (additive).
- `owner-auth.API07`: sets `emailVerifiedAt` when unset.
## Acceptance Criteria
1. account-registration.AC1 — Given no account for an email, when API02 is called with a valid
   body and no `ownerSecret`, then the response is 200 with a reference, one `users` document
   exists with `role: "member"`, no `emailVerifiedAt` and an argon2id hash, and one email with a
   6-digit code was sent to that address.
2. account-registration.AC2 — Given a verified account, when API02 is called with its email,
   then the response has the same message and shape as AC1, the stored account is unchanged,
   and no email is sent.
3. account-registration.AC3 — Given an unverified account, when API02 is called again with its
   email and a new password, then the password hash and display name are replaced and a fresh
   code is sent; the earlier reference stops working.
4. account-registration.AC4 — Given no owner and a configured secret, when API02 is called with
   the correct `ownerSecret`, then the account is created with `role: "owner"`, and API01 then
   answers `ownerClaimOpen: false`.
5. account-registration.AC5 — Given an owner already exists, or no secret is configured, or the
   value differs, when API02 is called with a non-empty `ownerSecret` (even the correct one),
   then the response is 403 `OWNER_CLAIM_REFUSED` and nothing is written or sent.
6. account-registration.AC6 — Given two owner claims with the correct secret racing, when both
   reach the database, then exactly one account is the owner and the other request answers 409
   `OWNER_EXISTS` with nothing written for it.
7. account-registration.AC7 — Given an unverified account and its code, when API03 is called
   with the reference and the right code, then `emailVerifiedAt` is set, the code and reference
   are deleted, the three session cookies are set as in `owner-auth.AC1`, and `data.user.role`
   is the account's role.
8. account-registration.AC8 — Given a code, when API03 is called with a wrong code 5 times, then
   a sixth call — even with the right code — answers `OTP_INVALID`; when the code is past its 10
   minutes, API03 answers `OTP_EXPIRED` and costs no attempt.
9. account-registration.AC9 — Given an unverified account, when `owner-auth.API01` is called
   with the right password, then the response is 403 `EMAIL_NOT_VERIFIED` and no session is
   created; with a wrong password it is the usual 401.
10. account-registration.AC10 — Given an unverified account, when API04 is called with its email,
    then a code is sent; for an unknown or verified email the response has the same shape and
    nothing is written or sent.
11. account-registration.AC11 — Given a verification code sent less than 60 s ago, when API05 is
    called, then the response is 429 with `Retry-After`; after 60 s a fresh code is sent and the
    old reference answers `OTP_INVALID`.
12. account-registration.AC12 — Given a password-reset reference, when it is used on API03 or
    API05, then the response is `OTP_INVALID`; a verification reference likewise fails on
    `owner-auth.API06`/`API07`.
13. account-registration.AC13 — Given an unverified account, when its password is reset through
    `owner-auth.API07`, then `emailVerifiedAt` is set and API01 signs it in.
14. account-registration.AC14 — Given five code sends from one IP across API02, API04, API05 and
    `owner-auth.API05`/`API06` within an hour, when a sixth is attempted on any of them, then
    the response is 429.
15. account-registration.AC15 — Given any registration request, then no log line contains the
    email, password, display name, owner secret, code or reference.
16. account-registration.AC16 — Given the development seeder (`owner-auth.T09`), when it creates
    its account, then the account is verified, and is the owner when no owner exists (a member
    otherwise); an existing unverified seeded account is marked verified on the next run.
## Edge Cases Covered
- Email case: stored and compared lower-cased (as `owner-auth`).
- `ownerSecret: ""` is treated as absent, so a form that always sends the field still registers
  members once the claim is closed.
- Display name: HTML tags and control characters stripped, trimmed; empty after stripping → 400.
- A user who registered, never verified and lost the reference uses API04, or registers again.
- Registering again for an unverified owner account without the secret keeps it the owner
  (the claim was already made with the secret); the code goes to the same address either way.
- The claim is closed while an owner document exists. The owner account cannot be suspended
  (`platform-admin`), so in practice it closes for good.
## Error Handling
| Scenario | Code |
|---|---|
| Schema failure | 400 `VALIDATION_FAILED` |
| Owner claim refused | 403 `OWNER_CLAIM_REFUSED` |
| Owner claim race lost | 409 `OWNER_EXISTS` |
| Email not verified at sign-in | 403 `EMAIL_NOT_VERIFIED` |
| Code errors | 400 `OTP_INVALID` / `OTP_EXPIRED` (as `owner-auth`) |
| Mail disabled / refused | 503 / 502 (as `owner-auth`) |
| Redis down | 503 `SERVICE_UNAVAILABLE` (as `owner-auth`) |
## Unit Test Cases (spec-derived)
- UT01 claim decision: open + match → owner; open + mismatch → refused; closed + match →
  refused; absent / empty → member; secret unset → closed.
- UT02 constant-time compare is used on equal-length digests (no early exit on length).
- UT03 register: new, unverified-existing, verified-existing (decoy) paths and what each writes.
- UT04 verify: right code; wrong code; attempts exhausted; expired; wrong purpose.
- UT05 request/resend: decoys; cooldown; reference rotation.
- UT06 login refuses an unverified account only after a correct password.
## Open Questions
None.
## Explicitly Out of Scope
- The registration and verification screens — `cms-panel-shell`.
- Purging accounts that never verify — deferred; an unverified account holds only its email and
  a password hash and is replaced by registering again.
- Suspension, listing users, owner privileges — `platform-admin`.
- Changing email or display name after registration — not requested.
- CAPTCHA — not requested; the code-send limiter bounds abuse.
## Non-Functional Constraints (from constitution.md)
- `users` stays the only authentication source; `auth` stays its only writer.
- Test-first scope: every route and the claim logic (auth). Real MongoDB and Redis in route
  tests; no real mail (`RecordingMailSender`).
- No email, password, secret, code or reference is logged.
