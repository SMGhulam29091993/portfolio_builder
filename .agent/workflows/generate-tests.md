# Workflow: Generate tests for a feature

Tests derive from acceptance criteria, never from reading finished code.

1. Start from the spec's `Unit Test Cases` table — those IDs are fixed. Add cases to
   `test_cases/<slug>.test_cases.md`; never renumber an existing ID.
2. ID prefixes: `UT` unit (service with fakes) · `IT` integration (repository or route against
   real MongoDB) · `CT` contract suite shared by every implementation of an interface ·
   `E2E` Playwright journey · `VR` Playwright visual baseline.
3. Per-layer convention is in `constitution.md` → Testing Discipline. Name each test with its ID:
   `it('publish-pipeline.UT03 — blocks publish when a placeholder remains', …)`.
4. Every AC maps to at least one test; every error row in an API exception table maps to one.
5. Fixtures are built by factories extending `FixtureFactory` in `apps/api/src/testing/` — never
   copied from seed data, so a seed edit cannot silently change a test's meaning. Integration
   tests get their `mongod` from `MongoTestHarness` there (one per spec file), and log
   assertions use its `RecordingLogger`.
6. A scenario spanning more than one spec goes in `test_cases/_integration.md`.
7. `E2E` specs live in `apps/web/e2e/` and run with `pnpm test:e2e`, which starts a throwaway
   MongoDB and the built API (`e2e/start-api.ts`) plus `next dev`. They are not part of
   `pnpm test`.
