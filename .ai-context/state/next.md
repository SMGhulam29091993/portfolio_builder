# next.md
## Queued
1. Watch the first CI run on the `feat/foundation-t09-test-harness-ci` PR. It is the CI
   confirmation every T01–T09 DoD line deferred; a red run reopens T09.
2. `monorepo-foundation.T10` — `docker-compose.dev.yml`, `.env.example` for both apps, README
   section. `apps/web/.env.example` needs `API_INTERNAL_URL`; the web dev origin is
   `http://localhost:3000` (pinned in its `dev` script). Any variable added there is also added
   to `turbo.json` (`architecture.md` → Environment). Not blocked; starts once the owner has
   merged `feat/foundation-t09-test-harness-ci`. Completing T10 completes the spec
   (`In Progress → Implemented`).
3. `owner-auth.T01` — blocked on: `monorepo-foundation` implemented; the spec moved to `Ready`.
4. `section-engine.T01` — blocked on: ADR-0005 accepted; `owner-auth` implemented.
5. Owner decisions still open in `blockers.md` — blocked on: the owner. New on 2026-10-17: the
   two cycles allowed by the module dependency map (blocks `publish-pipeline.T02`), and
   whether to untrack the build output and symlinks still committed (blocks nothing).

Order after that follows `project_context.md` → Feature slugs (build order).
