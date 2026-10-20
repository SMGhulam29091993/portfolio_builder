# Plan: Google Sign-in
## Derived From
.ai-context/specs/google-sign-in.spec.md
## Architecture Approach
In the `auth` module (`users` writer). Adapter + port for the provider; no new module or edge.
| Class | Layer | Implements | Depends on (interfaces) |
|---|---|---|---|
| `GoogleSignInService` | Service | `IGoogleSignInService` (start, complete) | `IOidcProvider`, `IOAuthStateStore`, `IUserReader`, `IUserCreator`, `IGoogleLinker`, `ISessionStarter`, `ISecureRandom`, `IClock` |
| `OidcProvider` | Adapter | `IOidcProvider` (authorizationUrl, exchange) — discovery, token exchange (fetch), ID-token verification (`jose`, remote JWKS) | options (issuer, client id, secret, redirect URL) from the container |
| `DisabledOidcProvider` | Adapter | `IOidcProvider` — every call throws `ServiceUnavailableError` | — |
| `RedisOAuthStateStore` | Repository (Redis) | `IOAuthStateStore` (put, take) | the `core` Redis client, `whileRedisAvailable` |
| `UserRepository` | Repository | adds `IGoogleLinker` (findByGoogleSub, linkGoogle) | `users` model |
| `AuthController` | Controller | `googleStart`, `googleCallback` | `IGoogleSignInService`, `ISessionCookieWriter`, `IOAuthStateCookie` |
| `OAuthStateCookie` | HTTP | `IOAuthStateCookie` (read, write, clear the `google-state` cookie) | `Env` (`NODE_ENV`) |
- The container chooses `OidcProvider` when all three Google variables are set, else
  `DisabledOidcProvider`; production with only some set refuses to start (ADR-0011).
- Redirect targets are built from `WEB_ORIGIN` only; the reason word comes from a fixed list.
## Data Model
- `users.googleSub?: string` — unique, sparse. `users.passwordHash` becomes optional (a
  Google-only account has none).
- Redis `auth:google-state:<state>` → `{ codeVerifier, nonce }`, TTL 600 s, taken with `GETDEL`.
## Environment
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URL` (the callback URL as the
browser reaches it), `GOOGLE_ISSUER` (default `https://accounts.google.com`, so tests can point
it at a local issuer).
## Constitution Check
- [x] Adapter + Factory-style selection in `container.ts`; no provider type crosses the port.
- [x] Redis use stays inside `auth` (ADR-0008).
- [x] Integration guard both ways: disabled when unconfigured (non-production and production);
  partial configuration fails production startup.
- [x] Test-first: both routes and the adapter, against a local issuer.
## Explicitly Deferred
- Caching the discovery document beyond the process lifetime — `jose`'s remote JWKS caches keys;
  discovery is fetched once per process.
