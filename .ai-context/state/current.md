# current.md
## In progress right now
- Nothing is `inprogress`. `owner-auth` is `In Progress`: T01–T04 are completed; T05
  (controller, cookies, routes API01–API04, `requireOwner`, container wiring) is next.
- T04 was built on its own branch, `feat/owner-auth-t04-auth-service`, cut from `master` after
  the PR #10 merge; check `git log` / `git branch -a` for whether it has been merged.
- T00–T03 (the spec revision, T01, T02, T03 and the records audit) reached `master` through
  PR #10 from `feat/owner-auth-t01-t03`. The three older stacked branches
  (`feat/auth-t00-spec-revision`, `feat/auth-t01-redis-infra`, `feat/auth-t02-models-stores`)
  are kept locally until the owner decides to delete them.
- Since T01, `pnpm test`, `pnpm test:e2e` and `pnpm dev` need the compose Redis
  (`docker compose -f docker-compose.dev.yml up -d --wait redis`), and `apps/api/.env` needs
  `REDIS_URL`.
- `monorepo-foundation` is `Implemented` (T01–T10 merged, PR #1–#9). The owner pushes and merges
  each branch — check `git log` / `git branch -a` before relying on any branch state.
