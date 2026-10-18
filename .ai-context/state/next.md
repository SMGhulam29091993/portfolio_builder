# next.md
## Queued
1. Confirm CI on `master` after the PR #14 merge, and the first CI run of
   `feat/owner-auth-t08-password-reset` once pushed. A red run reopens the task it breaks.
2. `owner-auth.T09` — `OwnerSeeder` (idempotent, 12-character minimum) and the `seed:owner`
   script (AC13, AC14). Unblocked: T08 is completed. Branch: a new `feat/owner-auth-t09-…` off
   `master` once T08 is merged. The seeder takes `IUserReader`, `IUserCreator`,
   `IPasswordHasher` and `Env` (plan → Architecture Approach); `OWNER_EMAIL` / `OWNER_PASSWORD`
   are not read by `env.ts` yet (commented in `.env.example`), so `env.ts`, `.env.example`,
   `turbo.json` and `architecture.md` → Environment change together. The route specs still create the owner through
   `UserRepository` directly; they may keep doing so. With T09 completed, `owner-auth` moves to
   `Implemented`.
   Carried to the deployment target: set Express `trust proxy` to the real hop count — until
   then `req.ip` is the web server's address behind the `/api/v1` rewrite, so the login limit
   is effectively per email and the code-send limit (T08) is shared by every client
   (`memory/review-findings.md`, 2026-10-18).
3. `section-engine.T01` — blocked on: ADR-0005 accepted; `owner-auth` implemented.
4. `cms-panel-shell` picks up the revised session handling (AC3, `SESSION_EXPIRED`, cross-tab
   refresh lock) and the forgot-password screen (AC15) when it is built. Its E2E15 needs "the
   recorded code", but `apps/web/e2e/start-api.ts` boots the API through `main.ts`, and only
   `buildContainer` accepts a `mailSender` (`owner-auth.T08`). That task decides how the E2E
   API gets a recording sender (for example a local `smtp-server` behind the Gmail strategy)
   without opening a test hook in production code.
5. Owner decisions still open in `blockers.md` — blocked on: the owner. Raised 2026-10-17: the
   two cycles allowed by the module dependency map (blocks `publish-pipeline.T02`), and
   whether to untrack the build output and symlinks still committed (blocks nothing).

Order after that follows `project_context.md` → Feature slugs (build order).
