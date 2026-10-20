# ADR-0011: Google sign-in is a second way to prove who a `users` record belongs to
**Status:** Accepted for the product decision — owner, 2026-10-18 ("email verification is
required along with google signin facility") · mechanics *Proposed* (flow, library, variables,
account linking; see Decision → Mechanics)

## Context
ADR-0010 opens registration to every user. The owner also wants users to be able to sign in
with Google. `agent-role.md` → Auth makes `users` the only source of truth for authentication,
and `constitution.md` → Infrastructure allows no external service without an ADR.

## Decision
- Google sign-in is allowed. It is a credential check, not a second identity store: a verified
  Google identity always resolves to one `users` record, and from there the session is the same
  one `owner-auth` issues (three cookies, one Redis session per user). Nothing about the session,
  the guard or the `jti` match changes.
- Google is an approved external integration for sign-in only. It is never used for anything
  else, and no AI provider is ever a login path.
- A Google identity whose email Google reports as verified counts as a verified email for
  ADR-0010's verification rule.

### Mechanics (*Proposed* — fixed by the `google-sign-in` spec, not here)
- OpenID Connect authorization-code flow with PKCE and a `state` value, run by the API; the ID
  token is verified against Google's published keys with `jose` (already pinned, ADR-0007), so no
  new runtime dependency is needed.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and the redirect URL are configuration. The same
  environment rule as mail (ADR-0009): outside production without them, the Google routes answer
  503; production fails startup only if Google sign-in is switched on and unconfigured.
- `users` gains the Google subject id (`googleSub`, unique, sparse). Linking a Google identity to
  an existing password account with the same email happens only when Google reports the email
  verified.
- The owner claim is never made through Google (owner, 2026-10-20; below).

### Owner answer, 2026-10-20
The owner claim is never made through Google: a Google sign-in that creates an account always
creates a `member` (ADR-0010 → Owner answers). The owner may link Google to their account
afterwards by signing in with Google using the same, Google-verified email.

## Consequences
- `constitution.md` → Infrastructure lists Google OpenID Connect as an approved integration for
  sign-in.
- `owner-auth`'s out-of-scope "OAuth / social login" now points at the `google-sign-in` spec.
- An account may have no password (Google only). `owner-auth`'s login must keep answering one
  identical 401 for it, and password reset can still give it a password; the `google-sign-in`
  spec states both.
