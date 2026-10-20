# Test Cases: Google Sign-in
## Derived From
.ai-context/specs/google-sign-in.spec.md
## Integration — `google-sign-in.routes.spec.ts` (real mongod + Redis, local issuer)
| ID | Covers | Case |
|---|---|---|
| IT01 | AC1 | Start redirects with every parameter; cookie equals state; Redis entry with TTL |
| IT02 | AC2, AC12 | New verified email → member without password, session, redirect to /cms |
| IT03 | AC3 | Existing password account linked; role kept; verified |
| IT04 | AC4 | Linked subject wins over a changed email |
| IT05 | AC5 | State mismatch / missing cookie / replay → `google_state` |
| IT06 | AC6 | Bad nonce → `google_failed` |
| IT07 | AC7 | Unverified email → `google_unverified`, nothing written |
| IT08 | AC8 | Other subject on a linked email → `google_conflict` |
| IT09 | AC9 | Unconfigured → `google_unavailable`; options `googleSignIn: false` |
| IT10 | AC10 | Google-only account: password login 401 |
| IT11 | AC11 | No secret value in logs |
## Adapter — `oidc-provider.spec.ts` (local issuer)
UT03 — URL parameters; exchange happy path; nonce, aud, iss, signature, expiry rejections.
## Store — `oauth-state-store.contract.spec.ts`
CT01 — put/take, take deletes, TTL expiry; Redis and in-memory.
## Unit — `google-sign-in.service.spec.ts`
UT01, UT02.
