# next.md
## Queued
1. `monorepo-foundation.T09` — test harness, coverage floor, `InProcessEventBus`, CI (AC1).
   Not blocked. Starts once the owner has merged `feat/foundation-t08-web-scaffold`. CI must
   set `API_INTERNAL_URL` for `pnpm build` (the web build fails fast without it) and should
   run `pnpm test:e2e` (E2E01) alongside build / typecheck / lint / test / drift.
2. `monorepo-foundation.T10` — `docker-compose.dev.yml`, `.env.example` for both apps, README
   section. `apps/web/.env.example` needs `API_INTERNAL_URL`; the web dev origin is
   `http://localhost:3000` (pinned in its `dev` script). Any variable added there is also added
   to `turbo.json` (`architecture.md` → Environment).
3. `owner-auth.T01` — blocked on: `monorepo-foundation` implemented; the spec moved to `Ready`.
4. `section-engine.T01` — blocked on: ADR-0005 accepted; `owner-auth` implemented.
5. Owner decisions still open in `blockers.md` — blocked on: the owner. New on 2026-10-17: the
   two cycles allowed by the module dependency map (blocks `publish-pipeline.T02`), and
   whether to untrack the build output and symlinks still committed (blocks nothing).

Order after that follows `project_context.md` → Feature slugs (build order).
