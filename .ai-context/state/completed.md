# completed.md
## Finished
- Spec set authoring (16 slugs × spec / plan / tasks / test cases, rules, ADR-0001–0007) —
  2026-10-11. Not an implementation task, so no DoD self-check line applies.
- monorepo-foundation.T01 — 2026-10-15 — DoD self-check: 2026-10-15, pass, with one recorded
  gap: CI does not exist until `monorepo-foundation.T09`, so "CI is green" was checked locally
  (`pnpm turbo run build typecheck lint test` passed; the immediate second run was fully
  cached). Re-confirmed in CI when T09 lands.
- monorepo-foundation.T02 — 2026-10-15 — DoD self-check: 2026-10-15, pass, with the same CI gap
  as T01 (checked locally: 10 tasks pass, second run fully cached, each `dist/` imports as ESM).

- monorepo-foundation.T03 — 2026-10-15 — DoD self-check: 2026-10-15, pass, with the same CI gap
  as T01 (checked locally: `pnpm turbo run build typecheck lint test` — 14 tasks pass, 30 API
  tests pass against a real `mongod`, second run fully cached). OpenAPI item not applicable: no
  route is mounted until T06.
- monorepo-foundation.T04 — 2026-10-15 — DoD self-check: 2026-10-15, pass, with the same CI gap
  as T01 (checked locally: 14 pipeline tasks pass, 61 API tests pass). OpenAPI item not
  applicable: no route is mounted until T06; AC6 is proven on a test app mounting `notFound`
  under `/api/v1`, and is re-proven on the real app in T06.
- monorepo-foundation.T05 — 2026-10-15 — DoD self-check: 2026-10-15, pass, with the same CI gap
  as T01 (checked locally: 14 pipeline tasks pass). Deviation: the task line said "applied to
  `/health`", but that route is created by T06; the sub-step moved to T06's line in the tasks
  file. AC11 is proven by IT06 on a test mount of `GET /api/v1/health` and is re-proven on the
  real route in T06.
- monorepo-foundation.T06 — 2026-10-15 — DoD self-check: 2026-10-15, pass, with the same CI gap
  as T01 (checked locally: `pnpm turbo run build typecheck lint test drift` — 16 tasks pass;
  `pnpm drift` reports the document in sync). Records: `health → core` added to the module
  dependency map; the request-lifecycle order now states that per-mount rate limiters run after
  the global JSON body parser; `int-standards.express.md` step 5 requires `ApiRouter`.
- monorepo-foundation.T07 — 2026-10-17 — DoD self-check: 2026-10-17, pass, with the same CI gap
  as T01 (checked locally: `pnpm turbo run build typecheck lint test drift` — 16 tasks pass,
  118 API tests pass; the second run is fully cached; editing a rule in
  `@portfolio/eslint-config` invalidates the API's lint cache). OpenAPI item not applicable: no
  route changed. Judgement call: `src/architecture/module-graph.ts` is function-based outside
  `core/`, accepted as build-excluded dev tooling on the same footing as `src/openapi/` (T06).
  Records: `architecture.md` → Boundary enforcement added and its stale header fixed; ADR-0007
  "proposed" wording removed from `constitution.md`, two plans' Constitution Check boxes ticked;
  `governance.md` Status refreshed; dependency-map cycle contradiction raised in `blockers.md`.
- monorepo-foundation.T08 — 2026-10-17 — DoD self-check: 2026-10-17, pass, with the same CI gap
  as T01 (checked locally: `pnpm turbo run build typecheck lint test drift` — 20 tasks pass,
  second run fully cached; `pnpm test:e2e` passes E2E01 and fails with 404 when the rewrite
  target is broken; `pnpm dev` from the root answers `/api/v1/health` on the web origin with
  200 and the API's `x-request-id`). OpenAPI item not applicable: no route changed. Frontend
  items: no hex or font literal; axe is not wired until the first UI task
  (`cms-panel-shell.T08`, the section T05s), so "axe clean" is deferred there, not claimed.
  Judgement call: the two placeholder pages carry a heading and one line of scaffold copy each —
  not portfolio content, which arrives only from the published snapshot. Records: ADR-0007 pins,
  `architecture.md` tree and Environment (Turborepo strict env rule, web dev port), ownership
  index, three pitfalls; tracked build artifacts raised in `blockers.md`.

<!-- Implementation entries take this form:
- <slug>.T<NN> — <date> — DoD self-check: <date>, pass
-->
