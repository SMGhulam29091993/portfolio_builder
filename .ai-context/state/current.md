# current.md
## In progress right now
- Nothing is `inprogress`. `owner-auth` is `In Progress`: T01 (Redis infrastructure) is
  completed on branch `feat/auth-t01-redis-infra`; T02 is next.
- Deviation: the T01 branch starts from `feat/auth-t00-spec-revision`, not from `master`,
  because the spec revision it builds on was not merged when T01 began. Merge T00 first; T01's
  PR then shows only its own commits.
- Since T01, `pnpm test`, `pnpm test:e2e` and `pnpm dev` need the compose Redis
  (`docker compose -f docker-compose.dev.yml up -d --wait redis`), and an existing
  `apps/api/.env` needs the `REDIS_URL` line from `.env.example`.
- `monorepo-foundation` is `Implemented` (T01–T10 merged, PR #1–#9). The owner pushes and merges
  each branch — check `git log` / `git branch -a` before relying on any branch state.
