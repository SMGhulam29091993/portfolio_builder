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
- monorepo-foundation.T09 — 2026-10-17 — DoD self-check: 2026-10-17, pass, with one recorded
  gap: `.github/workflows/ci.yml` exists but has not run yet — its first run is on this branch's
  PR, and that run is also the CI confirmation owed by T01–T08. Checked locally:
  `pnpm turbo run build typecheck lint test drift` — 20 tasks pass, 129 API tests;
  `scripts/check-turbo-cache.mjs` reports all 20 cached on the second run (and fails before
  it); `pnpm test:e2e` passes, also with no Playwright browsers present; the coverage floor
  fails when an untested service is added; `pnpm install --frozen-lockfile` is clean.
  OpenAPI item not applicable: no route changed. Judgement calls: the floor is per file
  (`memory/review-findings.md`); `InProcessEventBus` is built and tested but not yet created in
  `container.ts`, since nothing publishes or subscribes until `publish-pipeline`;
  `mongo-connection.spec.ts` and `main.spec.ts` keep their direct `MongoMemoryServer` use (the
  first tests the singleton itself, the second only needs a URI for child processes).
  Records: architecture (tree, In-process events), constitution coverage wording, ADR-0007 pins,
  ownership index, publish-pipeline plan (`IEventPublisher`, `IEventHandler`), test cases
  UT10–UT13 and IT16, two workflow steps, review finding and pitfall.
- monorepo-foundation.T10 — 2026-10-17 — DoD self-check: 2026-10-17, pass. CI for this branch
  runs on its PR; the CI gap recorded against T01–T09 is closed — the first CI run (PR #8,
  "Build, check and test") passed on 2026-10-17. Checked locally:
  `pnpm turbo run build typecheck lint test drift` — 20 tasks pass, 132 API tests;
  `scripts/check-turbo-cache.mjs` reports all 20 cached on the second run; editing
  `architecture.md` now misses the `test` cache; `pnpm test:e2e` passes; UT14 / UT15 fail on a
  missing example line, a commented-out required variable, a malformed value and a new
  `architecture.md` row. AC12 proven by hand on the documented path: both examples copied,
  `docker compose -f docker-compose.dev.yml up -d --wait` healthy, `pnpm dev`, then
  `GET http://localhost:3000/api/v1/health` → 200 `db: "up"` with the API `x-request-id`;
  stopping the container → 503 `SERVICE_UNAVAILABLE` within the 1 s probe timeout, no secret in
  the logs. OpenAPI item not applicable: no route changed. Judgement calls: the examples list
  every variable in `architecture.md` → Environment as the task says, but only the ones read
  today are uncommented, and secrets are blank; the compose MongoDB runs without auth and is
  bound to `127.0.0.1` rather than carrying a password literal; Ollama is not in compose, since
  `ai-design-studio` first uses it; the `WEB_REVALIDATE_URL, REVALIDATE_SECRET` row in
  `architecture.md` was split because the web app reads only the secret. Records: architecture
  (tree, header, Environment), ADR-0007 (mongo image pin), both int-standards Configuration
  sections, ownership index, plan, test cases UT14 / UT15, governance Status, project context,
  spec status `Implemented`, status board, pitfall.

<!-- Implementation entries take this form:
- <slug>.T<NN> — <date> — DoD self-check: <date>, pass
-->
- owner-auth spec revision — 2026-10-17 — the owner's session design (three `HttpOnly`
  cookies, one Redis session, triple `jti` match, no grace window) and OTP password reset;
  ADR-0008 and ADR-0009 accepted, ADR-0007 amended. Not an implementation task, so no DoD
  self-check line applies; the spec's DoR self-check passes (2026-10-17) and it awaits `Ready`.
- owner-auth.T01 — 2026-10-17 — DoD self-check: 2026-10-17, pass. Checked locally with the
  compose Redis running: `pnpm turbo run build typecheck lint test drift` (20 tasks; API 25 spec
  files / 160 tests incl. the new contract suite, coverage floor held), `pnpm test:e2e` (E2E01
  against Redis database 15), and an immediate second run fully cached. CI not yet run on this
  branch — the new Redis service container is first exercised by its PR. OpenAPI item not
  applicable: no route changed.
- owner-auth.T02 — 2026-10-17 — DoD self-check: 2026-10-17, pass. Checked locally with the
  compose Redis running: `pnpm turbo run build typecheck lint test drift` (20 tasks; API 29
  spec files / 214 tests, contracts 22 tests; coverage floor held — no auth service exists yet),
  `pnpm test:e2e` passed. OpenAPI item not applicable: no route changed. Container wiring is
  deferred to T05, the first task with a consumer.
- owner-auth.T03 — 2026-10-17 — DoD self-check: 2026-10-17, pass. Checked locally with the
  compose Redis running: `pnpm turbo run build typecheck lint test drift` (20 tasks; API 33
  spec files / 269 tests; coverage floor held — no auth service yet), `pnpm test:e2e` passed.
  OpenAPI item not applicable: no route changed. Built on T02's branch by the owner's
  instruction.
