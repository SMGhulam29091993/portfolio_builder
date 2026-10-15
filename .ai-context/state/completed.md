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

<!-- Implementation entries take this form:
- <slug>.T<NN> — <date> — DoD self-check: <date>, pass
-->
