# next.md
## Queued
1. Confirm the CI run on `master` after the PR #9 merge (`monorepo-foundation.T10`); a red run
   reopens T10 and moves the spec back to `In Progress`.
2. `owner-auth.T03` — `Argon2PasswordHasher`, `BcryptOtpHasher`, `JwtTokenIssuer`,
   `CryptoSecureRandom`, `SystemClock`, the `core/crypto` SHA-256 helper and their contract
   suites; pins argon2, bcrypt and the JWT library in ADR-0007. Unblocked: T02 is completed.
   When T04 adds in-memory fakes of `IUserReader` / `IOtpRepository`, they join a contract
   suite with the Mongo repositories (constitution → Liskov).
3. `section-engine.T01` — blocked on: ADR-0005 accepted; `owner-auth` implemented.
4. `cms-panel-shell` picks up the revised session handling (AC3, `SESSION_EXPIRED`, cross-tab
   refresh lock) and the forgot-password screen (AC15) when it is built.
5. Owner decisions still open in `blockers.md` — blocked on: the owner. Raised 2026-10-17: the
   two cycles allowed by the module dependency map (blocks `publish-pipeline.T02`), and
   whether to untrack the build output and symlinks still committed (blocks nothing).

Order after that follows `project_context.md` → Feature slugs (build order).
