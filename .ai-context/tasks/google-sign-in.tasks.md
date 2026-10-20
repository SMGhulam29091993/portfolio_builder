# Tasks: Google Sign-in
## Derived From
.ai-context/plans/google-sign-in.plan.md
## Sequence
- [x] google-sign-in.T01 — `users.googleSub` (unique sparse) and optional `passwordHash`; `IGoogleLinker` on the repository and fake; `IOAuthStateStore` → `RedisOAuthStateStore` and an in-memory fake with a contract suite — Acceptance: AC3, AC4, AC5 (store), AC10
- [x] google-sign-in.T02 — `IOidcProvider` → `OidcProvider` (discovery, PKCE URL, code exchange, `jose` ID-token checks) and `DisabledOidcProvider`; contract tests against a local issuer — Acceptance: AC1 (URL), AC6
- [x] google-sign-in.T03 — `GoogleSignInService`, `OAuthStateCookie`, controller handlers, routes API01–API02 with a callback limiter, Google variables in `env.ts`, `googleSignIn` in registration options, container selection, OpenAPI 0.6.0, route tests — Acceptance: AC1–AC12
