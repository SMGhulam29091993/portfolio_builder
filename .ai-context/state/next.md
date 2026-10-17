# next.md
## Queued
1. Watch CI on the `feat/foundation-t10-local-dev-env` PR; a red run reopens
   `monorepo-foundation.T10` and moves the spec back to `In Progress`.
2. `owner-auth.T01` — blocked on: the owner moving `owner-auth` to `Ready` (its DoR self-check
   runs first; `monorepo-foundation` is now implemented). Its variables (`WEB_ORIGIN`,
   `JWT_ACCESS_SECRET`, `OWNER_EMAIL`, `OWNER_PASSWORD`) are already listed, commented, in
   `apps/api/.env.example`; uncomment them as `env.ts` starts reading them.
3. `section-engine.T01` — blocked on: ADR-0005 accepted; `owner-auth` implemented.
4. Owner decisions still open in `blockers.md` — blocked on: the owner. Raised 2026-10-17: the
   two cycles allowed by the module dependency map (blocks `publish-pipeline.T02`), and
   whether to untrack the build output and symlinks still committed (blocks nothing).

Order after that follows `project_context.md` → Feature slugs (build order).
