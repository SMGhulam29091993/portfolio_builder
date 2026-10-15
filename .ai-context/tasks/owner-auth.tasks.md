# Tasks: Owner Authentication
## Derived From
.ai-context/plans/owner-auth.plan.md
## Sequence
- [ ] owner-auth.T01 — Contract schemas (`packages/contracts/src/auth`), `users` and `auth_sessions` models with indexes, `UserRepository`, `SessionRepository` behind their interfaces — Acceptance: AC1, AC4
- [ ] owner-auth.T02 — `IPasswordHasher` → `Argon2PasswordHasher`; `ITokenIssuer` → `JwtTokenIssuer`; `IClock` → `SystemClock`; contract suites for each interface — Acceptance: AC1, AC7
- [ ] owner-auth.T03 — `AuthService`: login (constant-work on unknown email), refresh with rotation, reuse detection and grace window, logout, me — Acceptance: AC1, AC2, AC4, AC5, AC6
- [ ] owner-auth.T04 — `AuthController`, `SessionCookieWriter`, `auth.routes.ts`, `RequireOwnerMiddleware`; wire in `container.ts`; document API01–API04 in OpenAPI — Acceptance: AC1, AC6, AC7, AC11
- [ ] owner-auth.T05 — Login rate limiter (IP + email, 5 per 15 min) and `OriginAllowListMiddleware` on `/auth` and `/cms` — Acceptance: AC3, AC8
- [ ] owner-auth.T06 — `OwnerSeeder` (idempotent, 12-character minimum) and the `seed:owner` script — Acceptance: AC9, AC10
