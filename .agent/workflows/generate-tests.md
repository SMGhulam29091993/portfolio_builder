# Workflow: Generate tests for a feature

Tests derive from acceptance criteria, never from reading finished code.

1. Start from the spec's `Unit Test Cases` table — those IDs are fixed. Add cases to
   `test_cases/<slug>.test_cases.md`; never renumber an existing ID.
2. ID prefixes: `UT` unit (service with fakes) · `IT` integration (repository or route against
   real MongoDB, and real Redis for Redis-backed stores) · `CT` contract suite shared by every implementation of an interface ·
   `E2E` Playwright journey · `VR` Playwright visual baseline.
3. Per-layer convention is in `constitution.md` → Testing Discipline. Name each test with its ID:
   `it('publish-pipeline.UT03 — blocks publish when a placeholder remains', …)`.
4. Every AC maps to at least one test; every error row in an API exception table maps to one.
5. Fixtures are built by factories extending `FixtureFactory` in `apps/api/src/testing/` — never
   copied from seed data, so a seed edit cannot silently change a test's meaning. Integration
   tests get their `mongod` from `MongoTestHarness` there (one per spec file), Redis-backed
   store tests get a claimed logical database on the real compose / CI Redis from
   `RedisTestHarness` (one per spec file; `reset()` between tests), and log assertions use its
   `RecordingLogger`. Service tests use the in-memory fakes there (`InMemorySessionStore`, …),
   each of which passes its interface's contract suite. No test sends real mail (ADR-0009):
   service and route tests inject `RecordingMailSender` (`refuseSends()` for the 502 path), and
   a new mail strategy joins the `IMailSender` contract suite, which runs the real adapter
   against a local `smtp-server`. Route tests set `WEB_ORIGIN` in the
   env they load and send `Origin: <WEB_ORIGIN>` on every non-GET under `/api/v1/auth` and
   `/api/v1/cms`, as the browser does; without it the allow-list answers 403 first
   (`owner-auth.AC12`).
6. A scenario spanning more than one spec goes in `test_cases/_integration.md`.
7. `E2E` specs live in `apps/web/e2e/` and run with `pnpm test:e2e`, which starts a throwaway
   MongoDB and the built API (`e2e/start-api.ts`, on the compose Redis's E2E database) plus
   `next dev`. They are not part of `pnpm test`.
