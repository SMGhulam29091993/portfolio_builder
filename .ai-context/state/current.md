# current.md
## In progress right now
- Nothing is `inprogress`. `owner-auth` is `In Progress`: T01–T03 are completed; T04
  (`SessionAuthorizer` and `AuthService`) is next.
- All unmerged `owner-auth` work is on one branch, `feat/owner-auth-t01-t03` (2026-10-17, by the
  owner's request): the spec revision, T01, T02, T03 and the records audit, in creation order.
  It was created at the tip of the stacked branches (`feat/auth-t00-spec-revision` ←
  `feat/auth-t01-redis-infra` ← `feat/auth-t02-models-stores`), which formed one linear chain
  on `master`, so no commit was rewritten or merged. The three older branches are kept locally
  until the owner decides to delete them.
- Since T01, `pnpm test`, `pnpm test:e2e` and `pnpm dev` need the compose Redis
  (`docker compose -f docker-compose.dev.yml up -d --wait redis`), and `apps/api/.env` needs
  `REDIS_URL`.
- `monorepo-foundation` is `Implemented` (T01–T10 merged, PR #1–#9). The owner pushes and merges
  each branch — check `git log` / `git branch -a` before relying on any branch state.
