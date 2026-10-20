# Ownership Index

Any fact (a collection, an endpoint contract, a payload type, a business rule) referenced by
more than one file appears here with exactly one canonical owner. Every other file links to the
owner — it never restates the full definition. Paths are relative to the repository root.

## Layer rules, SOLID enforcement, approved LLD patterns
**Canonical definition:** `.agent/rules/constitution.md` → Architectural Constraints
**Referenced by:** `agent-role.md`, `int-standards.express.md`, `code-review.md`, every plan's Constitution Check
**Last updated:** 2026-10-11

## In-process event semantics (`IEventBus`)
**Canonical definition:** `.ai-context/architecture.md` → In-process events
**Referenced by:** `publish-pipeline` spec (Error Handling) and plan; `int-standards.express.md` (Per-module file pattern → Events); `monorepo-foundation` plan; `apps/api/src/core/events/`
**Last updated:** 2026-10-17

## Response envelope and canonical error codes
**Canonical definition:** `.agent/rules/int-standards.express.md` → Standardised response shape
**Referenced by:** every spec's API Contract (exception tables name a code, not a shape); code: `apps/api/src/core/errors/` (generic codes), feature codes beside their thrower — `modules/auth/auth.errors.ts` (`SESSION_EXPIRED`, `OTP_INVALID`, `OTP_EXPIRED`, `EMAIL_NOT_VERIFIED`, `OWNER_CLAIM_REFUSED`), `modules/auth/user.repository.ts` (`OWNER_EXISTS`, `USER_EXISTS`), `core/http/origin-allow-list.middleware.ts` (`ORIGIN_NOT_ALLOWED`)
**Last updated:** 2026-10-18

## Module router convention (`ApiRouter`, mounted route table)
**Canonical definition:** `.agent/rules/int-standards.express.md` → Adding a feature, step 5
**Referenced by:** `.ai-context/architecture.md` → Request lifecycle, `apps/api/src/app.ts`
**Last updated:** 2026-10-15

## Optimistic concurrency (`revision` / `expectedRevision`)
**Canonical definition:** `.agent/rules/int-standards.express.md` → Optimistic concurrency
**Referenced by:** `section-engine`, `site-identity`, `design-theme`, `ai-design-studio`, `cms-panel-shell` specs
**Last updated:** 2026-10-11

## Tooling choices and pinned versions
**Canonical definition:** `.ai-context/decisions/ADR-0007-tooling-baseline.md` → Decision · Pinned versions
**Referenced by:** `constitution.md` (Testing Discipline), `pnpm-workspace.yaml`, every workspace `package.json`, `.github/workflows/ci.yml` (action SHAs, Node version), `docker-compose.dev.yml` (mongo and redis images), `.github/workflows/ci.yml` (redis service image), `README.md` → Local development (prerequisites)
**Last updated:** 2026-10-17

## Service coverage floor (80% lines and branches, per file)
**Canonical definition:** `.agent/rules/constitution.md` → Testing Discipline → Coverage floor
**Referenced by:** ADR-0007, ADR-0001, `governance.md` (Definition of Done), `monorepo-foundation` spec (Non-Functional Constraints), `.agent/workflows/implement-task.md`, `apps/api/vitest.config.ts`
**Last updated:** 2026-10-17

## API test support (`MongoTestHarness`, `RedisTestHarness`, `FixtureFactory`, `RecordingLogger`)
**Canonical definition:** `.agent/workflows/generate-tests.md` step 5 (usage); `apps/api/src/testing/` (code)
**Referenced by:** `int-standards.express.md` (Per-module file pattern → Tests), `architecture.md` → Repository layout, `monorepo-foundation.test_cases.md` (IT16, UT13), `owner-auth.test_cases.md` (IT13, CT03, CT04, CT07, CT10, CT11), `README.md` → Local development (which Redis databases the harnesses use); `apps/api/src/testing/auth/` (auth fakes and fixture factories)
**Last updated:** 2026-10-18

## Module list, dependency map, collection writers
**Canonical definition:** `.ai-context/architecture.md` → API modules · Module dependency map · Data ownership
**Referenced by:** `constitution.md`, every plan's Architecture Approach and Data Model,
`apps/api/src/architecture/module-dependency-map.ts` (the allowed edges as data, enforced by the architecture test),
`int-standards.express.md` (Adding a feature, step 6), `generate-plan.md` (step 8), `code-review.md` (SOLID and module boundaries)
**Last updated:** 2026-10-17

## Boundary lint rules and their exemptions
**Canonical definition:** `packages/eslint-config/api.js` (rules in `packages/eslint-config/plugin/`); summarised in `.ai-context/architecture.md` → Boundary enforcement
**Referenced by:** `apps/api/eslint.config.js`, `apps/api/src/architecture/boundary-lint.spec.ts`, `.agent/workflows/code-review.md`
**Last updated:** 2026-10-17

## Section type catalogue (types, orderable / hideable flags, owning spec)
**Canonical definition:** `.ai-context/architecture.md` → Section type catalogue
**Referenced by:** `section-engine`, `design-theme`, `public-site-rendering`, `cms-panel-shell` specs
**Last updated:** 2026-10-11

## Environment variables
**Canonical definition:** `.ai-context/architecture.md` → Environment
**Referenced by:** `monorepo-foundation`, `owner-auth`, `ai-design-studio`, `publish-pipeline`, `public-site-rendering` plans; `int-standards.nextjs.md` → Configuration; `int-standards.express.md` → Configuration; `.agent/workflows/generate-plan.md` step 9; `.agent/workflows/code-review.md` (Security); `apps/api/src/config/env.ts`, `apps/web/src/lib/env.ts`, `turbo.json` (`build.env`, `dev.passThroughEnv`), `apps/api/.env.example`, `apps/web/.env.example` (both checked against the table by `env-example.spec.ts`), `README.md` → Local development, `apps/web/e2e/start-api.ts` (the API's environment for E2E; `WEB_ORIGIN` from `playwright.config.ts`)
**Last updated:** 2026-10-19

## Reference content, visual tokens, design unknowns
**Canonical definition:** `.ai-context/design_reference.md`
**Referenced by:** `BRD.md`, the six section specs, `site-identity`, `design-theme`, `public-site-rendering` specs
**Last updated:** 2026-10-11

## Section engine endpoints (`section-engine.API01`–`API05`)
**Canonical definition:** `.ai-context/specs/section-engine.spec.md` → API Contract
**Referenced by:** the six section specs (each owns only its `data` payload), `cms-panel-shell` spec
**Last updated:** 2026-10-11

## Shared payload primitives (`EmphasisHeading`, `SectionMeta`, `Metric`, `LinkTarget`, `plainText` limits)
**Canonical definition:** `.ai-context/specs/section-engine.spec.md` → Shared payload primitives
**Referenced by:** the six section specs, `site-identity` spec
**Last updated:** 2026-10-11

## Identity payload (name, email, socials, résumé reference, availability, footer, SEO)
**Canonical definition:** `.ai-context/specs/site-identity.spec.md` → `site-identity.API02`
**Referenced by:** `hero-section`, `contact-section`, `public-site-rendering`, `publish-pipeline` specs
**Last updated:** 2026-10-11

## Asset reference (`assetId`, kinds, type and size limits)
**Canonical definition:** `.ai-context/specs/media-assets.spec.md` → Asset reference
**Referenced by:** `site-identity`, `publish-pipeline`, `public-site-rendering` specs
**Last updated:** 2026-10-11

## Public asset URL (`/api/v1/public/assets/:id/:filename`)
**Canonical definition:** `.ai-context/specs/public-site-rendering.spec.md` → `public-site-rendering.API02`
**Referenced by:** `media-assets` spec (states that it does not serve anonymous requests)
**Last updated:** 2026-10-11

## `DesignSpec` — `ThemeTokens`, layout map, variant catalogue, font allow-list, contrast rule
**Canonical definition:** `.ai-context/specs/design-theme.spec.md` → Design payload
**Referenced by:** `ai-design-studio`, `publish-pipeline`, `public-site-rendering`, `cms-panel-shell` specs
**Last updated:** 2026-10-11

## Session contract (cookies, Redis session, `requireOwner`, Origin allow-list)
**Canonical definition:** `.ai-context/specs/owner-auth.spec.md` → Session contract · Request authorization · Refresh
**Referenced by:** every spec with a `/api/v1/cms/**` endpoint (their 401 rows name `UNAUTHENTICATED` / `SESSION_EXPIRED` from the guard), `cms-panel-shell` spec, plan and test cases, `int-standards.nextjs.md` → API access, `architecture.md` → Request lifecycle, ADR-0008; code that restates its values: `apps/api/src/container.ts` (session, token and leeway lifetimes), `apps/api/src/modules/auth/session-cookie-writer.ts` (cookie names, paths, flags), `apps/api/openapi/openapi.yaml` (`sessionCookies` scheme, `OriginNotAllowed`, `LoginRateLimited`), `apps/api/src/core/http/origin-allow-list.middleware.ts` and `container.ts` `ORIGIN_CHECKED_PATHS` (the allow-list), `container.ts` `LOGIN_RATE_LIMIT` (5 failed sign-ins per 15 min, `owner-auth.T06`)
**Last updated:** 2026-10-18

## One-time-code contract (code, identifier, reference, expiry, attempts, cooldown, send limit)
**Canonical definition:** `.ai-context/specs/owner-auth.spec.md` → Password reset by one-time code
**Referenced by:** `account-registration` spec (Email verification: the same contract, purpose `email_verification`), `memory/patterns.md` (one-time code issuance), ADR-0008 (the reference key and its TTL), `owner-auth` plan → Architecture Approach and Data Model, `architecture.md` → Request lifecycle (the shared send limiter), `cms-panel-shell` spec AC15 (what the screen shows for each outcome); code that restates its values: `apps/api/src/modules/auth/password-reset.service.ts` (code length, identifier bytes, 10-minute expiry, 24-hour purge, 60-second cooldown, 5 attempts) and `registration.service.ts` (the same values), `apps/api/src/container.ts` (`CODE_SEND_RATE_LIMIT`, `OTP_REFERENCE_TTL_SEC`), `apps/api/src/modules/auth/otp.model.ts` (indexes), `apps/api/openapi/openapi.yaml` (API05–API07, `CodeSendRateLimited`, `OtpRejected`)
**Last updated:** 2026-10-18

## Redis unreachable at runtime → 503, never fail open
**Canonical definition:** `.ai-context/decisions/ADR-0008-redis-session-store.md` → Decision (startup and runtime behaviour)
**Referenced by:** `owner-auth` spec → Edge Cases and plan → Architecture Approach, `owner-auth.test_cases.md` (IT13), `architecture.md` → Request lifecycle (the mechanism), `memory/pitfalls.md` (2026-10-17, queued commands); code: `apps/api/src/core/redis/redis-connection.ts` (`disableOfflineQueue`), `apps/api/src/core/redis/redis-availability.ts`, its callers `modules/auth/session.store.ts` and `modules/auth/otp-reference.store.ts` (since `owner-auth.T08`)
**Last updated:** 2026-10-18

## Redis logical databases (0 development · 1–14 API test harness · 15 E2E)
**Canonical definition:** `README.md` → Local development (Redis, tests)
**Referenced by:** `docker-compose.dev.yml` (redis service comment), `apps/api/.env.example` (`REDIS_URL`), `apps/api/src/testing/redis-test-harness.ts`, `apps/web/e2e/start-api.ts`
**Last updated:** 2026-10-17

## One-time codes (password reset: code, identifier, reference, expiry, attempts)
**Canonical definition:** `.ai-context/specs/owner-auth.spec.md` → Password reset by one-time code
**Referenced by:** `cms-panel-shell` spec (AC15), `architecture.md` → Data ownership, ADR-0007 (bcrypt row), ADR-0008
**Last updated:** 2026-10-17

## Mail port and strategy selection (`IMailSender`, `MailSenderFactory`)
**Canonical definition:** `.ai-context/decisions/ADR-0009-mail-delivery.md` → Decision
**Referenced by:** `owner-auth` spec (Mail delivery) and plan, `constitution.md` (Approved LLD patterns, Infrastructure), `architecture.md` → Environment; `.agent/workflows/generate-tests.md` step 5 (no real mail in tests), `README.md` → Local development; code: `mail-sender.factory.ts` (the decision), `container.ts` → `MAIL_STRATEGIES` (the priority order), `password-reset.service.ts` (calls `ensureAvailable` before any work)
**Last updated:** 2026-10-18

## `PublishedContent` snapshot shape, `IDraftContributor`, publish rules
**Canonical definition:** `.ai-context/specs/publish-pipeline.spec.md` → Published content · Publish rules
**Referenced by:** `public-site-rendering`, `section-engine`, `site-identity`, `design-theme`, the six section specs
**Last updated:** 2026-10-11

## AI provider port and environment rules
**Canonical definition:** `.ai-context/specs/ai-design-studio.spec.md` → Provider contract (the *why* is `.ai-context/decisions/ADR-0003-ai-provider-port.md`)
**Referenced by:** `constitution.md` (dev-bypass guard), `architecture.md` (AI design flow)
**Last updated:** 2026-10-11

## Accounts, roles, the one-time owner claim and tenant isolation
**Canonical definition:** `.ai-context/decisions/ADR-0010-multi-tenant-accounts.md` → Decision and Owner answers (the product rule); `.ai-context/specs/account-registration.spec.md` → Roles and the owner claim · Email verification (the mechanics)
**Referenced by:** `BRD.md` (BRD-001, BRD-002, BRD-009, BRD-011), `agent-role.md` (Route audiences), `constitution.md` (Tenant isolation), `int-standards.express.md` (Persistence conventions), `.agent/workflows/code-review.md` (Security), `architecture.md` (System overview, Data ownership, Environment), `owner-auth` spec (Status, Intent, AC13, AC14, AC23, Out of Scope) and plan, `apps/api/.env.example`; code that restates its rules: `modules/auth/owner-claim.policy.ts`, `user.model.ts` (`one_owner` index), `auth.service.ts` (the `EMAIL_NOT_VERIFIED` check), `registration.service.ts`, `seed/owner.seeder.ts` (production refusal; verified owner or member)
**Last updated:** 2026-10-20

## Seeder port and seed data (`ISeeder`, `SeedOutcome`, `buildSeeders`, `apps/api/src/seed/data/`)
**Canonical definition:** `apps/api/src/seed/seeder.interface.ts` (the port); `apps/api/src/container.ts` → `buildSeeders` (wiring); `constitution.md` → Security Posture (seed data lives in `seed/data/`)
**Referenced by:** `owner-auth` plan (Architecture Approach, Data Model) and tasks (T09); `section-engine` plan and tasks (T06); `architecture.md` (repository tree); `test_cases/_integration.md` (INT09)
**Last updated:** 2026-10-19

## Password length bounds (12 to 200 characters)
**Canonical definition:** `packages/contracts/src/auth/auth-contracts.ts` (`PASSWORD_MIN_LENGTH`, `PASSWORD_MAX_LENGTH`)
**Referenced by:** `owner-auth` spec (AC14, AC18, API01, API07); `apps/api/src/seed/owner.seeder.ts` (imports both); `architecture.md` → Environment (`OWNER_PASSWORD` row); `apps/api/.env.example`; `README.md` (`pnpm seed:owner`)
**Last updated:** 2026-10-19

## Google sign-in boundary
**Canonical definition:** `.ai-context/decisions/ADR-0011-google-sign-in.md` → Decision (the rule); `.ai-context/specs/google-sign-in.spec.md` → Flow · Resolving the user (the mechanics)
**Referenced by:** `BRD.md` (BRD-010), `agent-role.md` (Auth), `constitution.md` (Infrastructure), `owner-auth` spec (Out of Scope) and plan, `architecture.md` (Environment, Data ownership); code that restates it: `modules/auth/google-sign-in.service.ts`, `adapters/oidc-provider.ts`, `oauth-state-cookie.ts`, `container.ts` (`GOOGLE_STATE_TTL_SEC`, `GOOGLE_RATE_LIMIT`, `buildOidcProvider`), `config/env.ts` (all-or-nothing rule)
**Last updated:** 2026-10-20

## Free-text cleaning (`plainText`)
**Canonical definition:** `packages/contracts/src/common/plain-text.ts` (`plainText`, `cleanPlainText`)
**Referenced by:** `int-standards.express.md` → Input validation, `constitution.md` → Plain text only, `account-registration` (`displayName`), every section payload schema
**Last updated:** 2026-10-20

## Portfolio provisioning, slug rules and the reference template
**Canonical definition:** `.ai-context/specs/section-engine.spec.md` → Portfolio provisioning · Slug rules
**Referenced by:** ADR-0010 (Owner answers: template, path address), `public-site-rendering` (serves `<platform>/<slug>`), `publish-pipeline` (the placeholder rule blocks unedited template content), every section spec (`defaults()` is the template); code: `packages/contracts/src/sections/engine.ts` (`SLUG_PATTERN`, `RESERVED_SLUGS`), `modules/portfolio/portfolio.provisioner.ts`, `resolve-portfolio.middleware.ts`
**Last updated:** 2026-10-20

## Section payload primitives (`listItem`, `safeUrlSchema`, …)
**Canonical definition:** `.ai-context/specs/section-engine.spec.md` → Shared payload primitives; code `packages/contracts/src/sections/primitives.ts`
**Referenced by:** the six section specs, `site-identity`, `publish-pipeline` (URL re-check), `modules/portfolio/section.service.ts` (item-id assignment), `seed/section.seeder.ts` (fixed ids)
**Last updated:** 2026-10-20

## Asset reference, kinds and limits
**Canonical definition:** `.ai-context/specs/media-assets.spec.md` → Asset reference; code `packages/contracts/src/assets/assets-contracts.ts` (`ASSET_RULES`)
**Referenced by:** `site-identity` (résumé and OG image ids), `publish-pipeline` (snapshot references), `public-site-rendering` (public delivery); code: `modules/assets/asset.service.ts`, `apps/web/src/lib/cms/assets.ts` (screen text from the same limits)
**Last updated:** 2026-10-20
