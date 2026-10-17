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

<!-- Template
### <date> — <slug>.T<NN>
**Finding:** ...
**Resulting rule/check added:** ...
-->
