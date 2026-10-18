# current.md
## In progress right now
- Nothing is `inprogress`. `owner-auth` was ⚠️ REVISED on 2026-10-18 and is back in `Draft`
  (the product became multi-tenant — ADR-0010, ADR-0011). T01–T08 are completed and stand;
  T09, now a development-only seeder, waits for the owner to settle `owner-auth.OQ1` (the
  seeded `displayName`) and move the spec back to `Ready`.
- The revision is records only, on its own branch `feat/owner-auth-t09-registration-revision`,
  cut from `master` after the PR #15 merge (T08); check `git log` / `git branch -a` for whether
  it has been merged. No code changed.
- Since T08, `POST /api/v1/auth/password/forgot`, `/resend` and `/reset` are live. With the
  Gmail variables blank they answer 503 for every address; sign-in is unaffected.
- Since T07, `NODE_ENV=production` refuses to start without `GMAIL_USER` and
  `GMAIL_APP_PASSWORD`. Locally they may stay blank: mail is then disabled and only password
  reset is affected.
- Since T06 the API also needs `WEB_ORIGIN` (a bare origin, `http://localhost:3000` for
  `pnpm dev`) in `apps/api/.env`, or it refuses to start; every non-GET to `/auth` and `/cms`
  must send exactly that `Origin`.
- Since T05 the API also needs `JWT_ACCESS_SECRET` (32+ characters) in `apps/api/.env`, or it
  refuses to start.
- T00–T03 reached `master` through PR #10, T05 through PR #12, T07 through PR #14 and T08
  through PR #15. The three older stacked branches (`feat/auth-t00-spec-revision`,
  `feat/auth-t01-redis-infra`, `feat/auth-t02-models-stores`) are kept locally until the owner
  decides to delete them.
- Since T01, `pnpm test`, `pnpm test:e2e` and `pnpm dev` need the compose Redis
  (`docker compose -f docker-compose.dev.yml up -d --wait redis`), and `apps/api/.env` needs
  `REDIS_URL`.
- `monorepo-foundation` is `Implemented` (T01–T10 merged, PR #1–#9). The owner pushes and merges
  each branch — check `git log` / `git branch -a` before relying on any branch state.
