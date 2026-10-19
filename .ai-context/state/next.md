# next.md
## Queued
1. Confirm CI on `feat/owner-auth-t09-dev-seeder` and, after the merge, on `master`. A red run
   reopens `owner-auth.T09`.
   Carried to the deployment target (from `owner-auth`): set Express `trust proxy` to the real
   hop count — until then `req.ip` is the web server's address behind the `/api/v1` rewrite, so
   the login limit is effectively per email and the code-send limit (T08) is shared by every
   client (`memory/review-findings.md`, 2026-10-18).
2. Write the `account-registration` spec (BRD-009, ADR-0010 mechanics): registration, email
   verification with a new one-time-code `purpose`, `role` and the one-time owner claim, the
   guard refusing unverified accounts. Needs the owner's answer on what the owner role may do
   (`blockers.md`). Then `google-sign-in` (BRD-010, ADR-0011).
3. `section-engine.T01` — blocked on: ADR-0005 accepted; the spec
   revised for one portfolio per user (ADR-0010, `status.md`).
4. `cms-panel-shell` picks up the revised session handling (AC3, `SESSION_EXPIRED`, cross-tab
   refresh lock), the forgot-password screen (AC15) and now the registration and verification
   screens when it is built. Its E2E15 needs "the recorded code", but
   `apps/web/e2e/start-api.ts` boots the API through `main.ts`, and only `buildContainer`
   accepts a `mailSender` (`owner-auth.T08`). That task decides how the E2E API gets a
   recording sender (for example a local `smtp-server` behind the Gmail strategy) without
   opening a test hook in production code.
5. Owner decisions still open in `blockers.md` — blocked on: the owner.

Order after that follows `project_context.md` → Feature slugs (build order).
