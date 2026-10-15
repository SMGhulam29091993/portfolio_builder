# Plan: Owner Authentication
## Derived From
.ai-context/specs/owner-auth.spec.md
## Architecture Approach
Module `apps/api/src/modules/auth/` in the module file pattern.
| Class | Layer | Implements | Depends on (interfaces) |
|---|---|---|---|
| `AuthController` | Controller | — | `IAuthService` |
| `AuthService` | Service | `IAuthService` | `IUserRepository`, `ISessionRepository`, `IPasswordHasher`, `ITokenIssuer`, `IClock` |
| `UserRepository`, `SessionRepository` | Repository | `IUserRepository`, `ISessionRepository` | Mongoose models |
| `Argon2PasswordHasher` | Adapter | `IPasswordHasher` | — |
| `JwtTokenIssuer` | Adapter | `ITokenIssuer` (sign / verify access token, mint opaque refresh token) | `Env` |
| `RequireOwnerMiddleware` | HTTP | — | `ITokenIssuer` |
| `OriginAllowListMiddleware` | HTTP (`core/http`) | — | `Env` |
| `OwnerSeeder` | Seed | `ISeeder` | `IUserRepository`, `IPasswordHasher`, `Env` |
- `index.ts` exports `IAuthGuard` (the `requireOwner` handler type) and `AuthContext`; other
  modules receive the guard instance from the container and import nothing else.
- Cookie reading/writing lives in a small `SessionCookieWriter` used only by the controller —
  the service never sees `req`/`res`.
- `IClock` is injected so expiry, grace-window and rate-limit tests are deterministic.
- Patterns: Repository; Adapter (hasher, token issuer) — both from the approved list.
## Data Model
**`users`** — `_id`, `email` (unique, lower-case), `passwordHash`, `displayName`, `createdAt`,
`updatedAt`.
**`auth_sessions`** — `_id`, `userId` (index), `familyId` (index), `tokenHash` (unique),
`expiresAt` (TTL index), `rotatedAt`, `successorId`, `revokedAt`, `createdAt`.
Seed: one user from `OWNER_EMAIL` / `OWNER_PASSWORD`; no literal credentials anywhere.
## Constitution Check
- [x] No new datastore introduced without ADR
- [x] Auth boundary: `users` only; no external provider
- [x] Only interfaces cross layers; classes instantiated in `container.ts`
- [x] Nothing logged from the PII/secret list
- [x] Test-first scope covers all four endpoints and the guard
- [ ] argon2id as the hasher — pending acceptance of ADR-0007
## Explicitly Deferred
- Password change / reset — no requirement yet (BRD-002 open items).
- 2FA — open at BRD stage.
- "Sign out everywhere" UI — the repository supports `revokeFamily`; no endpoint is exposed.
## Sequencing
1. Contracts, models, repositories
2. Hasher and token-issuer adapters
3. `AuthService`
4. Controller, routes, `requireOwner`, container wiring, OpenAPI
5. Login rate limit and Origin allow-list
6. Owner seeder
