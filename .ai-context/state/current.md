# current.md
## In progress right now
- Nothing is `inprogress`. `owner-auth` is `In Progress`: T01 and T02 are completed; T03
  (hasher, token, random and clock adapters) is next.
- Deviation: T01 and T02 branches are stacked (`master` ← T00 ← T01 ← T02, branch
  `feat/auth-t02-models-stores`) because none was
  merged when the next began. Merge them in that order; each PR then shows only its own
  commits.
- Since T01, `pnpm test`, `pnpm test:e2e` and `pnpm dev` need the compose Redis
  (`docker compose -f docker-compose.dev.yml up -d --wait redis`), and an existing
  `apps/api/.env` needs the `REDIS_URL` line from `.env.example`.
- `monorepo-foundation` is `Implemented` (T01–T10 merged, PR #1–#9). The owner pushes and merges
  each branch — check `git log` / `git branch -a` before relying on any branch state.
