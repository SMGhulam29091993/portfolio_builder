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

<!-- Template
### <date> — <slug>.T<NN>
**Finding:** ...
**Resulting rule/check added:** ...
-->
