# next.md
## Queued
1. Owner: review the multi-tenant revision (ADR-0010, ADR-0011, BRD-001/002/009–011, the
   `owner-auth` ⚠️ REVISED block) and answer `owner-auth.OQ1` — where the development seeder's
   `displayName` comes from (proposed: `OWNER_DISPLAY_NAME`). Then move `owner-auth` back to
   `Ready` (Definition of Ready re-run recorded by the agent).
2. `owner-auth.T09` — development-only `OwnerSeeder` (idempotent, 12-character minimum,
   refuses in production) and the `seed:owner` script (AC13, AC14, AC23). Blocked on item 1.
   Branch: a new `feat/owner-auth-t09-…` off `master` once the revision is merged. The seeder
   takes `IUserReader`, `IUserCreator`, `IPasswordHasher` and `Env`, lives in
   `apps/api/src/seed/` (a top-level node in the architecture graph, so no map edge) and is
   built by the container. `OWNER_EMAIL` / `OWNER_PASSWORD` (and OQ1's variable) are read by
   `env.ts` as optional, so the server starts without them; the seeder enforces presence,
   length and the production refusal itself. `env.ts`, `.env.example`, `turbo.json` and
   `architecture.md` → Environment change together. With T09 completed, `owner-auth` moves to
   `Implemented`.
   Carried to the deployment target: set Express `trust proxy` to the real hop count — until
   then `req.ip` is the web server's address behind the `/api/v1` rewrite, so the login limit
   is effectively per email and the code-send limit (T08) is shared by every client
   (`memory/review-findings.md`, 2026-10-18).
3. Write the `account-registration` spec (BRD-009, ADR-0010 mechanics): registration, email
   verification with a new one-time-code `purpose`, `role` and the one-time owner claim, the
   guard refusing unverified accounts. Needs the owner's answer on what the owner role may do
   (`blockers.md`). Then `google-sign-in` (BRD-010, ADR-0011).
4. Confirm CI on `master` after the PR #15 merge. A red run reopens the task it breaks.
5. `section-engine.T01` — blocked on: ADR-0005 accepted; `owner-auth` implemented; the spec
   revised for one portfolio per user (ADR-0010, `status.md`).
6. `cms-panel-shell` picks up the revised session handling (AC3, `SESSION_EXPIRED`, cross-tab
   refresh lock), the forgot-password screen (AC15) and now the registration and verification
   screens when it is built. Its E2E15 needs "the recorded code", but
   `apps/web/e2e/start-api.ts` boots the API through `main.ts`, and only `buildContainer`
   accepts a `mailSender` (`owner-auth.T08`). That task decides how the E2E API gets a
   recording sender (for example a local `smtp-server` behind the Gmail strategy) without
   opening a test hook in production code.
7. Owner decisions still open in `blockers.md` — blocked on: the owner.

Order after that follows `project_context.md` → Feature slugs (build order).
