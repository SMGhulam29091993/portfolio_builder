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

<!-- Template
### <date> — <slug>.T<NN>
**Finding:** ...
**Resulting rule/check added:** ...
-->
