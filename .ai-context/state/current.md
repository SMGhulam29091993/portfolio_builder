# current.md
## In progress right now
- Nothing is `inprogress`. `owner-auth` is `In Progress`: T01–T08 are completed; T09 (the
  owner seeder) is next and last.
- T08 was built on its own branch, `feat/owner-auth-t08-password-reset`, cut from `master` after
  the PR #14 merge (T07); check `git log` / `git branch -a` for whether it has been merged.
- Since T08, `POST /api/v1/auth/password/forgot`, `/resend` and `/reset` are live. With the
  Gmail variables blank they answer 503 for every address; sign-in is unaffected.
- Since T07, `NODE_ENV=production` refuses to start without `GMAIL_USER` and
  `GMAIL_APP_PASSWORD`. Locally they may stay blank: mail is then disabled and only password
  reset is affected.
- Since T06 the API also needs `WEB_ORIGIN` (a bare origin, `http://localhost:3000` for
  `pnpm dev`) in `apps/api/.env`, or it refuses to start; every non-GET to `/auth` and `/cms`
  must send exactly that `Origin`.
- T05 reached `master` through PR #12 from `feat/owner-auth-t05-routes-guard`.
- Since T05 the API also needs `JWT_ACCESS_SECRET` (32+ characters) in `apps/api/.env`, or it
  refuses to start.
- T00–T03 (the spec revision, T01, T02, T03 and the records audit) reached `master` through
  PR #10 from `feat/owner-auth-t01-t03`. The three older stacked branches
  (`feat/auth-t00-spec-revision`, `feat/auth-t01-redis-infra`, `feat/auth-t02-models-stores`)
  are kept locally until the owner decides to delete them.
- Since T01, `pnpm test`, `pnpm test:e2e` and `pnpm dev` need the compose Redis
  (`docker compose -f docker-compose.dev.yml up -d --wait redis`), and `apps/api/.env` needs
  `REDIS_URL`.
- `monorepo-foundation` is `Implemented` (T01–T10 merged, PR #1–#9). The owner pushes and merges
  each branch — check `git log` / `git branch -a` before relying on any branch state.
