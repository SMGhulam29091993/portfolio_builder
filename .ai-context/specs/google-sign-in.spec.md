# Spec: Google Sign-in
## Spec ID
google-sign-in
## Status
In Progress
- `Ready → In Progress` on 2026-10-20 with `google-sign-in.T01` started.
- DoR self-check: 2026-10-20, pass. Moved `Draft → Ready` by the agent under the owner's
  standing authorisation of 2026-10-20 (`governance.md`).
- Written 2026-10-20 from ADR-0011 (decision, mechanics and the owner answer of 2026-10-20).
## Linked BRD
.ai-context/BRD.md#BRD-010
## Intent
Let a user sign in — or create an account — with Google. The API runs the OpenID Connect
authorization-code flow with PKCE, a `state` value and a nonce, verifies Google's ID token, and
resolves it to exactly one `users` record: by the Google subject id, else by a Google-verified
email (which links Google to that account), else by creating a new, verified `member`. From
there the session is the one `owner-auth` issues. Google never creates the platform owner.
## Context
- Builds on: .ai-context/specs/owner-auth.spec.md (session, cookies),
  .ai-context/specs/account-registration.spec.md (roles, verification),
  .ai-context/decisions/ADR-0011-google-sign-in.md
- Related: `cms-panel-shell` (the "Continue with Google" button and the error notices)
- Shared facts used: .ai-context/ownership_index.md (Session contract · Environment variables)
## Flow
| Step | What happens |
|---|---|
| 1 | The browser navigates to API01. The API mints `state` (128-bit), a PKCE `code_verifier` (256-bit; challenge `S256`) and a `nonce` (128-bit); stores `{ codeVerifier, nonce }` in Redis at `auth:google-state:<state>` for 10 minutes; sets the `google-state` cookie to `state`; redirects (302) to the issuer's authorization endpoint with `response_type=code`, `scope=openid email profile`, `client_id`, `redirect_uri`, `state`, `nonce`, `code_challenge`, `code_challenge_method=S256` |
| 2 | Google redirects the browser to API02 with `code` and `state` |
| 3 | The API requires the `google-state` cookie to equal the `state` query value, then takes (get-and-delete) the Redis entry; any mismatch or a missing entry fails |
| 4 | Exchanges `code` with the `code_verifier` at the token endpoint; verifies the ID token's signature against the issuer's JWKS, `iss`, `aud` (= client id), expiry, and `nonce` |
| 5 | Resolves the user (below), starts the session (three cookies, `owner-auth`), clears `google-state`, redirects (302) to `<WEB_ORIGIN>/cms` |
| ✗ | Any failure clears `google-state` and redirects (302) to `<WEB_ORIGIN>/cms/login?error=<reason>`; nothing about the cause beyond the reason word is exposed |
## Resolving the user
1. A user whose `googleSub` equals the token's `sub` → that user.
2. Else, when the token's `email_verified` is true, a user with that email → Google is linked to
   it (`googleSub` set) and its `emailVerifiedAt` is set when unset.
3. Else, when `email_verified` is true → a new user: `role: "member"`, no password,
   `emailVerifiedAt` now, `displayName` from the token's `name` (cleaned by `plainText`;
   falls back to the email's local part).
4. Else (Google reports the email unverified) → failure `google_unverified`.
- A user found by email whose `googleSub` is already set to another subject → failure
  `google_conflict` (never re-linked silently).
- A Google-only account has no password: `owner-auth.API01` answers it the same 401 as a wrong
  password, and the password reset can give it one (`account-registration.AC13` verifies it).
## Session cookies after a cross-site redirect
The callback is a top-level navigation that started on Google, so a browser does not send
`SameSite=Strict` cookies on the redirect to `/cms` that follows. The session cookies are set
on the callback response and are sent from the CMS's first same-site request (`GET
/api/v1/auth/me`), which is how the CMS shell loads the user anyway. The `google-state` cookie
is `SameSite=Lax` because it must arrive on the callback itself.
## API Contract
### google-sign-in.API01 — GET /api/v1/auth/google/start
**Success (302):** to the authorization endpoint (Flow step 1); `Set-Cookie: google-state=…;
HttpOnly; Path=/api/v1/auth/google; Max-Age=600; SameSite=Lax` (+ `Secure` in production).
**Failure (302):** to `/cms/login?error=google_unavailable` when Google is not configured, and
`error=google_failed` when the issuer's discovery document cannot be read.
### google-sign-in.API02 — GET /api/v1/auth/google/callback
**Query:** `code`, `state` (strings ≤ 2048), or `error` (Google's own, e.g. the user cancelled).
**Success (302):** to `<WEB_ORIGIN>/cms` with the three session cookies set and `google-state`
cleared.
**Failure (302)** to `<WEB_ORIGIN>/cms/login?error=…`:
| Reason | Condition |
|---|---|
| `google_unavailable` | Google not configured |
| `google_cancelled` | Google returned `error` |
| `google_state` | Cookie and query `state` differ, either is missing, or the Redis entry is gone (expired or used) |
| `google_failed` | Code exchange or ID-token verification failed |
| `google_unverified` | Google reports the email unverified and no account has this subject |
| `google_conflict` | The email's account is linked to a different Google subject |
| `rate_limited` | More than 20 callbacks per IP in 15 minutes |
### Change to `account-registration.API01`
`data` gains `googleSignIn: boolean` — true when Google is configured (additive).
## Acceptance Criteria
1. google-sign-in.AC1 — Given Google is configured, when API01 is requested, then the response
   is 302 to the authorization endpoint carrying `state`, `nonce`, an S256 `code_challenge`,
   the client id, the redirect URL and `scope=openid email profile`, the `google-state` cookie
   equals `state`, and Redis holds the verifier and nonce for 10 minutes.
2. google-sign-in.AC2 — Given a valid callback for a new, Google-verified email, then a verified
   `member` without a password is created with `googleSub` set, the three session cookies are
   set, and the response redirects to `/cms`.
3. google-sign-in.AC3 — Given an existing password account with the same email and
   `email_verified` true, then Google is linked to it (`googleSub` set, `emailVerifiedAt` set if
   it was unset), its role is unchanged, and the user is signed in.
4. google-sign-in.AC4 — Given a user already linked to the subject, then the same user is
   signed in even if the token's email changed.
5. google-sign-in.AC5 — Given a callback whose `state` cookie and query differ, or whose Redis
   entry is missing or already used, then the response redirects with `error=google_state`
   and no user or session is created.
6. google-sign-in.AC6 — Given an ID token with a wrong `nonce`, `aud`, `iss`, signature or an
   expired `exp`, then the response redirects with `error=google_failed`.
7. google-sign-in.AC7 — Given `email_verified` false and no linked user, then `error=google_unverified`
   and nothing is written.
8. google-sign-in.AC8 — Given an account linked to subject A, when Google returns subject B for
   the same email, then `error=google_conflict` and the link is unchanged.
9. google-sign-in.AC9 — Given Google is not configured, then API01 and API02 redirect with
   `error=google_unavailable`, `account-registration.API01` answers `googleSignIn: false`, and
   the API still starts (in production too, unless the variables are only partly set).
10. google-sign-in.AC10 — Given a Google-only account, when `owner-auth.API01` is called with any
    password, then the response is the same 401 as a wrong password.
11. google-sign-in.AC11 — No log line contains a code, state, verifier, nonce, ID token, email or
    cookie value.
12. google-sign-in.AC12 — Given a new account created through Google while the owner claim is
    open, then it is a `member`.
## Edge Cases Covered
- Google returns `error=access_denied` (user cancelled) → `google_cancelled`.
- The same callback URL replayed → the Redis entry is gone → `google_state`.
- Name missing or only markup → display name from the email's local part.
- A user signed in elsewhere: Google sign-in replaces that session like any sign-in.
## Error Handling
All failures are redirects with a reason word (table above); the 302 never carries a body with
details. Redis down → `google_failed` redirect after logging the failure class only.
## Unit Test Cases (spec-derived)
- UT01 user resolution: by sub; by verified email (link); create; unverified; conflict.
- UT02 state check: missing cookie, mismatch, missing entry, replay.
- UT03 the provider adapter's token checks (nonce, aud, iss, signature, expiry) against a local
  issuer with its own keys.
## Open Questions
None.
## Explicitly Out of Scope
- Unlinking Google from an account; linking from inside the CMS while signed in.
- Other identity providers.
- The CMS button and error notices — `cms-panel-shell`.
## Non-Functional Constraints (from constitution.md)
- `users` stays the only identity source; Google is a credential check (ADR-0011).
- The provider is configuration (`GOOGLE_ISSUER`), never a URL literal in code.
- No real Google in tests: a local issuer with generated keys stands in.
