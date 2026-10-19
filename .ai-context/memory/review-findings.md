# review-findings.md — a real self-review finding worth remembering

### 2026-10-15 — monorepo-foundation.T03
**Finding:** The checklist item "no `new` of a service, repository, adapter or controller
outside `container.ts`" needed a judgement call: `main.ts` constructs `JsonLogger` and
`ApplicationLifecycle` and calls `MongoConnection.getInstance()`. These are core infrastructure
that must exist before the container (the logger reports env failures; the connection is an
input to `buildContainer(env, connection)` per the plan), so they are not a violation.
**Resulting rule/check added:** none yet — `monorepo-foundation.T07` must scope its
instantiation lint rule to service / repository / adapter / controller classes, or allow
`main.ts`, so this startup code stays legal. Since `monorepo-foundation.T06` the same applies to
`src/openapi/check-drift.ts`, which builds the container without connecting.
_Resolved 2026-10-17 by `monorepo-foundation.T07`:_ `portfolio/no-instantiation-outside-container`
covers only classes declared under `src/modules/`, so core infrastructure stays constructible
in `main.ts` and `check-drift.ts` with no file exemption.

### 2026-10-17 — monorepo-foundation.T07
**Finding:** Encoding `architecture.md` → Module dependency map as data showed that, as written,
it allows `portfolio ↔ publishing` and `design ↔ publishing` in both directions: `publishing`
depends on `portfolio` (pointer writer/reader) and `design` (`IDesignValidator`), while
`portfolio` and `design` depend on `publishing` to implement `IDraftContributor`. The
constitution requires the module graph to be a DAG. The architecture section's own footnote
also says `publishing` *owns* `IPublishedPointerWriter`, which would make that edge
`portfolio → publishing` only.
**Resulting rule/check added:** the architecture test asserts the *actual* graph is acyclic
(`findCycles`), so neither cycle can be built silently. The map itself is unchanged — it is an
owner decision, raised in `state/blockers.md`, to be settled before `publish-pipeline.T02`.

### 2026-10-17 — monorepo-foundation.T09
**Finding:** Vitest coverage thresholds are aggregate by default: with several services, one
fully tested service could lift an untested one over the 80% floor, so "80% on services" would
hold on paper while a service shipped with no tests.
**Resulting rule/check added:** `thresholds.perFile: true` in `apps/api/vitest.config.ts`, and
the constitution now says "per file". Verified by adding a temporary untested service under
`src/modules/`: `pnpm test` failed on the floor.

### 2026-10-17 — owner-auth.T01
**Finding:** `RedisConnection` made `IDatabaseConnection` a two-implementation interface, but
each class only had its own spec, so nothing proved the two behave the same through the port
that `ApplicationLifecycle` relies on (fail-fast connect, idempotent disconnect).
**Resulting rule/check added:** `core/db/database-connection.contract.spec.ts`, one
`describe.each` suite run against both classes on real servers. A third datastore joins by
adding one subject to its list.

### 2026-10-17 — owner-auth.T05
**Finding:** The note carried from T04 said the controller *and the guard* clear all three
cookies on 401s. For the guard that would be wrong: its usual 401 is `UNAUTHENTICATED` for an
access token past its 15 minutes, and clearing the cookies then would make the refresh that
repairs it impossible. The spec clears them on guard step 3 (`SESSION_EXPIRED`) only.
**Resulting rule/check added:** `RequireOwnerMiddleware` clears on `SESSION_EXPIRED` only, and
`require-owner.middleware.spec.ts` asserts no `Set-Cookie` on an expired token.

### 2026-10-17 — owner-auth.T05
**Finding:** The AC15 log check in `auth.routes.spec.ts` was first written in `afterAll`, so no
test carried the AC's ID and a failure there would not have been reported against it.
**Resulting rule/check added:** It is the file's last named test (`owner-auth.AC15 / IT15`) and
asserts it saw tokens, so it cannot pass vacuously.

### 2026-10-18 — owner-auth.T06
**Finding:** `architecture.md` → Request lifecycle placed the module rate limiter *before* the
Origin allow-list. Built that way, a refused cross-origin request would reach the login limiter,
and the allow-list would have to be repeated inside every `/auth` and `/cms` router, missing any
`/cms` path no router serves yet. AC12 only requires the 403 before authentication.
**Resulting rule/check added:** the app factory mounts `OriginAllowListMiddleware` on the
`/api/v1/auth` and `/api/v1/cms` prefixes ahead of every router; the lifecycle line now reads
Origin allow-list → rate limiter. `auth.routes.spec.ts` proves a refused body is never counted
and that a POST to an unserved `/cms` path is 403.

### 2026-10-18 — owner-auth.T06
**Finding:** `RateLimiterFactory` counted every request on arrival, so it could not express
"5 *failed* sign-ins" (AC3), and counting on response alone would let parallel attempts all
pass before the first one failed.
**Resulting rule/check added:** the policy's optional `counts(status)` gives a slot back once
the response is known not to count; the slot is held while the request is in flight.
`rate-limiter-factory.spec.ts` parks two requests on a gate and asserts the third is 429.

### 2026-10-18 — owner-auth.T06 (open, not fixed here)
**Finding:** Express's `trust proxy` is still unset, and in development and production the
browser reaches the API through the web app's `/api/v1` rewrite. `req.ip` is then the web
server's address for every client, so the login limiter's "IP + email" key is effectively
"email" alone: anyone can lock the owner out of sign-in for 15 minutes with 5 wrong passwords
(`Origin` is a browser guard, not an authenticator; a script can send it). AC3 holds as
written, since the key is still IP + email.
**Resulting rule/check added:** none yet; queued in `state/next.md` for the deployment-target
work, which must set `trust proxy` to the real hop count before the limiter means per-client.

### 2026-10-18 — owner-auth.T08
**Finding:** A reset that reads `attempts`, compares the code and only then increments lets
guesses sent in parallel all read `attempts < 5` before any of them fails, so one burst gets
far more than five compares against a 6-digit code.
**Resulting rule/check added:** `PasswordResetService.reset` claims the attempt with the atomic
`incrementAttempts` before comparing and refuses once the returned count passes 5.
`password-reset.service.spec.ts` → "guesses sent in parallel cannot get more than five
compares" fires 20 guesses at once (fails with the claim removed).

### 2026-10-18 — owner-auth.T08
**Finding:** With mail disabled outside production, an unknown address took the decoy path,
which sends nothing, so API05 answered 200 where the spec and ADR-0009 say 503 — and the
owner's 503 came only after a code document and reference had been written.
**Resulting rule/check added:** `IMailSender.ensureAvailable()` (ADR-0009, amended 2026-10-18),
called first by `requestCode` and `resend`. `owner-auth.IT22` now sends both addresses and
asserts nothing is written; it fails with the call removed.

### 2026-10-19 — owner-auth.T09
**Finding:** The smoke run of `pnpm seed:owner` against a developer's `apps/api/.env` from before
T05 refused on `JWT_ACCESS_SECRET` and `WEB_ORIGIN`, although the seeder uses MongoDB only: the
script parses the environment with the API's one `loadEnv`, so a `.env` that cannot start the
API cannot seed either. Kept on purpose — a second, seeder-only schema would be a second reader
of `process.env`. Also checked: in production the script connects to MongoDB before the seeder
refuses; AC23 forbids reading or hashing, not connecting, and the refusal stays in one place.
**Resulting rule/check added:** `README.md` → `pnpm seed:owner` says the `.env` must also pass
the API's own checks; `seed-owner.spec.ts` (IT26) proves `users` stays empty in production.

<!-- Template
### <date> — <slug>.T<NN>
**Finding:** ...
**Resulting rule/check added:** ...
-->
