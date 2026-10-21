# current.md
## In progress right now
- 2026-10-21: building the whole project on `feat/full-build` (owner's request of 2026-10-20),
  one spec after another in the build order of `project_context.md`, stopping only for an owner
  decision. Done so far: everything through `ai-design-studio`, and `design-library` (the
  owner's request of 2026-10-21, ADR-0014), both `Implemented`. Next up: write the
  `platform-admin` spec (no spec exists yet), then build it.
- Local environment notes: `apps/api/.env` needs `WEB_ORIGIN`, `JWT_ACCESS_SECRET`, `REDIS_URL`;
  `apps/web/.env` now also needs `NEXT_PUBLIC_SITE_URL` (e.g. `http://localhost:3000`) — the web
  app refuses to start without it; set `WEB_REVALIDATE_URL` and the same `REVALIDATE_SECRET` in
  both apps to see publishes refresh the site at once (otherwise pages refresh within 300 s).
  `pnpm test`, `pnpm test:e2e` and `pnpm dev` need the compose Redis. `pnpm test:e2e` runs beside
  `pnpm dev` (its own `.next-e2e` build directory).
