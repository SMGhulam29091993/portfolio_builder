# ADR-0008: Redis holds auth sessions and one-time-code references
**Status:** Accepted — owner, 2026-10-17 (the owner specified Redis for the refresh token, the
`jti` and the one-time-code reference)

## Context
`constitution.md` → Infrastructure approves MongoDB as the only datastore and names Redis as one
that needs an ADR. The owner's session design (`owner-auth` → Session contract) checks the
access token's `jti` against a stored session on every CMS request, keeps strictly one session
per user, and maps a password-reset reference to its identifier. Each of these is short-lived,
keyed lookup state with a natural expiry, which Redis serves with per-key TTLs and atomic
compare-and-set.

## Decision
- Redis is an approved datastore for **`auth` only**, for two keyspaces:
  `auth:session:<userId>` (one session, TTL 7 days) and `auth:otp-ref:<reference>` (TTL 24
  hours). No other module stores data in Redis without a new ADR.
- MongoDB stays the system of record. Losing Redis loses sessions and pending references only:
  the owner signs in again or requests a new code. Redis persistence is therefore not required.
- `auth` reaches Redis through role-sized interfaces it owns (`ISessionStore`,
  `IOtpReferenceStore`). `RedisSessionStore` and `RedisOtpReferenceStore` implement them;
  in-memory fakes implement them for service tests; one shared contract suite runs against both.
- Session rotation is a single atomic compare-and-set on the presented `jti` (a Lua script), so
  two concurrent refreshes cannot both succeed.
- One Redis client per process, created in `core/` beside the MongoDB connection and closed in
  graceful shutdown. The singleton rule extends to it.
- `REDIS_URL` is a required variable. Startup connects and pings Redis after MongoDB and before
  listening; failure exits with code 1, as for MongoDB. At runtime an unreachable Redis makes
  the guard and the auth routes answer 503 `SERVICE_UNAVAILABLE`; nothing fails open.
- Local development and tests run a real Redis server: a pinned `redis` image in
  `docker-compose.dev.yml` and a Redis service container in CI. Redis-backed stores are never
  tested against a mock client.
- The client library and image are pinned in ADR-0007 by the task that installs them.

## Consequences
- `pnpm test` for `apps/api` needs a reachable Redis (compose locally, a service in CI), where
  until now `mongodb-memory-server` made the suite self-contained. Only the Redis store specs
  need it; service specs use the fakes.
- Rate-limit counters stay in process memory (`monorepo-foundation`); moving them to Redis is a
  possible later change and is not part of this decision.
- `constitution.md` → Infrastructure lists Redis with this scope, and the startup sequence and
  the Singleton row include the Redis client.
