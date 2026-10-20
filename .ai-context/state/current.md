# current.md
## In progress right now
- 2026-10-20: the owner asked for the rest of the project to be built on one branch,
  `feat/full-build` (cut from `master` after PR #17), one task after another in the build order
  of `project_context.md`, stopping only when a decision needs the owner. Every open question
  was answered first (`state/blockers.md` → Resolved 2026-10-20). Next up: the
  `account-registration` spec. Check `git log feat/full-build` for how far the build has got.
- Local environment notes carried from `owner-auth`: `apps/api/.env` needs `WEB_ORIGIN`,
  `JWT_ACCESS_SECRET`, `REDIS_URL`; `pnpm test`, `pnpm test:e2e` and `pnpm dev` need the compose
  Redis (`docker compose -f docker-compose.dev.yml up -d --wait redis`); mail variables may stay
  blank locally (password reset then answers 503).
