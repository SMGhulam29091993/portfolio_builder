# Project Status Board
_Last updated: 2026-10-20_

Lifecycle: `Draft → Ready → In Progress → Implemented → Released` (`governance.md`). Only the
owner moves a spec to `Ready`.

## Active Specs
| # | Spec ID | Title | Status | BRD | Blocked on before `Ready` |
|---|---|---|---|---|---|
| 1 | `monorepo-foundation` | Turborepo, API bootstrap, shared packages | Implemented | BRD-007 | — |
| 2 | `owner-auth` | Sign-in, the single Redis session per user, password reset by one-time code | Implemented | BRD-002 | — |
| 2a | `account-registration` | Registration, email verification, roles, the one-time owner claim | Implemented | BRD-009 | — |
| 2b | `google-sign-in` | Google OpenID Connect sign-in into a `users` record | Implemented | BRD-010 | — |
| 3 | `section-engine` | Section registry and draft content engine | Draft | BRD-001 | ADR-0005; revise for ADR-0010 (portfolio per user) |
| 4 | `cms-panel-shell` | CMS layout, editor host, live preview | Draft | BRD-001 | Revise for ADR-0010 (registration and verification screens) |
| 5 | `site-identity` | Name, contact, socials, résumé link, footer, SEO | Draft | BRD-001 | OQ1 link targets, OQ2 SEO text; revise for ADR-0010 |
| 6 | `media-assets` | Résumé and image uploads | Draft | BRD-006 | Revise for ADR-0010 (serves bytes to the asset's own user, not "the owner") |
| 7 | `design-theme` | Theme tokens and layout variants | Draft | BRD-003 | OQ1 fonts, OQ2 accent; ADR-0006; revise for ADR-0010 (one design per user's portfolio) |
| 8 | `hero-section` | Hero, code card, tech marquee | Draft | BRD-001 | OQ1 clipped values, OQ2 marquee motion |
| 9 | `about-section` | Bio, currently, stats, process | Draft | BRD-001 | — |
| 10 | `work-showcase` | Featured project and project cards | Draft | BRD-001 | — (OQ1 Second Brain copy blocks the first publish, not `Ready`) |
| 11 | `experience-timeline` | Role timeline | Draft | BRD-001 | — |
| 12 | `stack-credentials` | Skills, education, certifications | Draft | BRD-001 | — |
| 13 | `contact-section` | Contact card | Draft | BRD-001 | — |
| 14 | `publish-pipeline` | Validate, snapshot, publish, rollback | Draft | BRD-005 | ADR-0004; revise for ADR-0010 |
| 15 | `public-site-rendering` | Public site shell, SEO, fidelity | Draft | BRD-003 | OQ1 mobile nav, OQ2 motion; revise for ADR-0010 (portfolio per request host) |
| 16 | `ai-design-studio` | AI design proposals | Draft | BRD-004 | ADR-0006, ADR-0003 mechanics; revise for ADR-0010 (per-user limits) |

`OQ<n>` refers to the numbered Open Questions section of that spec.

## Planned slugs — no spec written yet (ADR-0010, ADR-0011)
| Slug | Title | BRD | Place in the build order |
|---|---|---|---|
| `platform-admin` | The owner's admin area (list, suspend, re-enable members) and platform settings | BRD-009, BRD-011 | After `ai-design-studio` (added 2026-10-20, ADR-0010 → Owner answers) |
| `credits-billing` | Buying credits through Stripe; spending them on AI generations and domains | BRD-011 | After `platform-admin` (ADR-0012) |
| `custom-domains` | Attaching a user's own domain; free portfolios on the platform domain | BRD-011 | After `credits-billing` |

## Daily Execution Log
### 2026-10-20
- The owner answered every open question in one session and asked for the rest of the project
  to be built on one branch (`feat/full-build`), stopping only for a new decision. Recorded:
  ADR-0004 (retention amendment), ADR-0005 and ADR-0006 (variant amendment) accepted; ADR-0012
  (Stripe) and ADR-0013 (`publishing` owns its ports, which removes the map's two cycles)
  accepted; owner answers appended to ADR-0010 and ADR-0011; BRD-001, -003, -004, -009, -010,
  -011 updated; `design_reference.md` → Unknowns answered; standing authorisation to move specs
  to `Ready` recorded in `governance.md`; new planned slug `platform-admin`. Build output and
  symlinks untracked from git.
- `account-registration` written (spec, plan, tasks, test cases), moved `Draft → Ready` under
  the standing authorisation, and implemented: T01 (contracts, `plainText`, `users.role`,
  `emailVerifiedAt`, the `one_owner` index, registrar ports), T02 (`OwnerClaimPolicy`,
  `RegistrationService`, `AuthService` as session starter, login refuses unverified accounts,
  reset verifies the email and checks the code purpose, `OWNER_REGISTRATION_SECRET`, seeder),
  T03 (five routes, shared code-send limit, OpenAPI 0.5.0, route tests). `Implemented`.
- `google-sign-in` written, moved to `Ready` under the standing authorisation, and implemented:
  T01 (`googleSub`, optional password, `IGoogleLinker`, Redis OAuth state store), T02
  (`OidcProvider` with `jose`, `LocalOidcIssuer` for tests), T03 (`GoogleSignInService`,
  redirects-only controller, state cookie, Google variables all-or-nothing, `googleSignIn` in
  registration options, OpenAPI 0.6.0). `Implemented`.
### 2026-10-19
- `owner-auth.OQ1` resolved by the owner (a fixed `displayName`, `Owner`, as seed data); DoR
  re-run and passed; `owner-auth` moved `Draft → Ready` by the owner, then `In Progress`.
- `owner-auth.T09` completed on `feat/owner-auth-t09-dev-seeder`: `ISeeder`, `OwnerSeeder`
  (refuses in production first, then checks `OWNER_EMAIL` and a 12–200 character
  `OWNER_PASSWORD`, idempotent by email), `SeedRefusedError` / `SeedConfigurationError`,
  `seed/data/owner.ts`, `buildSeeders` in `container.ts`, the `seed:owner` script (API and
  root); `OWNER_EMAIL` / `OWNER_PASSWORD` read by `env.ts` as optional. With it `owner-auth`
  moved `In Progress → Implemented`. No route changed; OpenAPI stays 0.4.0.
### 2026-10-18
- The product became multi-tenant (owner, while `owner-auth.T09` was being started): anyone
  registers, email verification is required, Google sign-in is offered, the platform owner is
  claimed once with a secret key, every user builds their own portfolio, credits buy a custom
  domain. ADR-0010 and ADR-0011 accepted for the decision (mechanics proposed); BRD-001 and
  BRD-002 revised, BRD-009 to BRD-011 added; `agent-role.md`, `constitution.md` (Tenant
  isolation, Google as an approved integration), `int-standards.express.md` and the self-review
  checklist amended. `owner-auth` ⚠️ REVISED and set back to `Draft`: T01–T08 stand, T09 is now
  a development-only seeder (AC13, AC14 reworded, AC23 and OQ1 added). Four planned slugs added.
  On branch `feat/owner-auth-t09-registration-revision`; no code changed.
- `owner-auth.T08` completed on `feat/owner-auth-t08-password-reset`: `PasswordResetService`
  (request with a decoy for unknown addresses, resend with the 60 s cooldown, reset with
  attempts claimed atomically before the compare), routes API05–API07 with a shared code-send
  limiter (5 per hour per IP), `OtpInvalidError` / `OtpExpiredError`, the reference store on
  `whileRedisAvailable`, `IMailSender.ensureAvailable` (503 for every address with mail
  disabled); contract suite CT11 and `InMemoryOtpRepository`; OpenAPI 0.4.0.
- `owner-auth.T07` completed on `feat/owner-auth-t07-mail-port`: the `IMailSender` port,
  `GmailMailSender` (nodemailer 10.1.2, plain text, log-safe failure cause), `DisabledMailSender`
  (503) and `MailSenderFactory` (strategies registered in `container.ts`; production without one
  fails startup naming the variables); `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `MAIL_FROM` read by
  `env.ts`; contract suite CT06 and `RecordingMailSender`; startup closes the datastores when
  the container cannot be built.
- `owner-auth.T06` completed on `feat/owner-auth-t06-rate-limit-origin`: the login rate limiter
  (5 failed sign-ins per IP + email in 15 min; `RateLimiterFactory` gains `counts`, slots held
  while in flight; limiters on the container clock) and `OriginAllowListMiddleware` on every
  non-GET under `/auth` and `/cms`, mounted ahead of the routers; `WEB_ORIGIN` read by
  `env.ts`; OpenAPI 0.3.0 adds 403 to API01–API03 and 429 to API01.

### 2026-10-17
- `owner-auth.T05` completed on `feat/owner-auth-t05-routes-guard`: `AuthController`,
  `auth.routes.ts` (API01–API04, OpenAPI 0.2.0), `RequireOwnerMiddleware` (clears cookies on
  `SESSION_EXPIRED` only), `SessionCookieWriter`, `parseCookieHeader`; the auth module wired in
  `container.ts`; `JWT_ACCESS_SECRET` read by `env.ts`; Redis failures answer 503 at once
  (`disableOfflineQueue`, `whileRedisAvailable`). Rate limit and Origin allow-list are T06.
- `owner-auth.T04` completed on `feat/owner-auth-t04-auth-service`: `SessionAuthorizer` (the one
  `jti` triple match, with an ignore-expiry mode for refresh and logout) and `AuthService`
  (login with a decoy hash for unknown emails, refresh with refresh-hash check and
  compare-and-set rotation, idempotent logout, `me`); `SessionExpiredError` (401
  `SESSION_EXPIRED`); `InMemoryUserRepository` and contract suite CT10. Both services at 100%
  line and branch coverage. Not yet wired into `container.ts` or routed — T05.
- `owner-auth.T03` completed on `feat/auth-t02-models-stores` with T02 (owner's instruction):
  `Argon2PasswordHasher` (argon2id m=64 MiB, t=3, p=4, ~33 ms), `BcryptOtpHasher` (cost 10,
  72-byte guard), `JwtTokenIssuer` (HS256 pinned, exactly four claims, 30 s leeway,
  signature-only mode for refresh), `CryptoSecureRandom`, `SystemClock`, `core/crypto`
  `sha256Hex`; fakes for service tests; contract suites CT01, CT02, CT05, CT08, CT09. Pinned
  argon2 0.45.1, bcryptjs 3.0.3, jose 6.2.12.
- `owner-auth.T02` completed on branch `feat/auth-t02-models-stores` (stacked on T01):
  `packages/contracts/src/auth` (API01–API07 payloads), `users` and `otps` models with their
  indexes, `UserRepository` (reader / creator / password-writer roles) and `OtpRepository`,
  `RedisSessionStore` (hash per user; `MULTI` replace, Lua compare-and-set and conditional
  delete) and `RedisOtpReferenceStore`, in-memory fakes and fixture factories, contract suites
  CT03 / CT04. One pitfall found and fixed: upsert filter keys skip Mongoose validation.
- `owner-auth` moved `Draft → Ready` by the owner and `Ready → In Progress`. `owner-auth.T01`
  completed on branch `feat/auth-t01-redis-infra` (cut from the unmerged
  `feat/auth-t00-spec-revision`): Redis 8.10.2 in `docker-compose.dev.yml` and as a CI service
  (one digest), `@redis/client` 6.3.0, `core/redis` (`RedisConnection` singleton,
  `IRedisClientProvider`), `REDIS_URL`, startup MongoDB → Redis with clean-up on failure and
  reverse-order shutdown in `ApplicationLifecycle`, `RedisTestHarness` (claimed logical
  database per spec file), the `IDatabaseConnection` contract suite (CT07). Tests now need the
  compose Redis running.
- `owner-auth` revised to the owner's design on branch `feat/auth-t00-spec-revision`: JWT access
  token, refresh token and `jti` in three `HttpOnly` cookies; strictly one session per user in
  Redis with a triple `jti` match on every CMS request and `SESSION_EXPIRED` for a superseded
  browser; refresh by signature-only verify and compare-and-set rotation, no grace window;
  password reset by a 6-digit emailed code (bcrypt, 10-minute expiry, 5 attempts, 60-second
  resend). ADR-0008 (Redis) and ADR-0009 (mail strategy, Gmail default) accepted by the owner;
  ADR-0007 amended; constitution, architecture, error codes, `cms-panel-shell` and BRD-002
  follow. Tasks are now T01–T09. The spec stays `Draft` until the owner moves it to `Ready`.
- `monorepo-foundation.T10` completed on branch `feat/foundation-t10-local-dev-env`, and with it
  the spec (`In Progress → Implemented`): `docker-compose.dev.yml` (`mongo` 8.2.6 pinned by
  digest, loopback only), `.env.example` for both apps with drift tests UT14 / UT15,
  `README.md` → Local development; `architecture.md` is now a `test` input in `turbo.json`. The
  first CI run (PR #8) passed, closing the CI gap recorded against T01–T09.
- `monorepo-foundation.T09` completed on branch `feat/foundation-t09-test-harness-ci`:
  `core/events` (`IEventBus`, `InProcessEventBus`), `src/testing/` (`MongoTestHarness`,
  `FixtureFactory`, `RecordingLogger`), per-file 80% coverage floor on module services, and
  `.github/workflows/ci.yml` with the AC1 cache check (IT13). CI has not run yet.
- `monorepo-foundation.T08` completed on branch `feat/foundation-t08-web-scaffold`: `apps/web`
  (Next.js 16, Tailwind v4), `(site)` and `(cms)` placeholder pages, `/api/v1` rewrite,
  `lib/env.ts`, Playwright E2E01 proving AC12. Raised: build artifacts still tracked in git
  (`state/blockers.md`).
- `monorepo-foundation.T07` completed on branch `feat/foundation-t07-boundary-lint`: the
  `portfolio/*` boundary lint rules (AC9 a–d) and the architecture test against the module
  dependency map (IT10, IT11). Raised: the map, as written, allows two cycles the constitution
  forbids — owner decision before `publish-pipeline.T02` (`state/blockers.md`).
### 2026-10-15
- ADR-0007 accepted by the owner as proposed; `monorepo-foundation` moved to `Ready`, then
  `In Progress` with `monorepo-foundation.T01` started.
- `monorepo-foundation.T01` completed: pnpm + Turborepo workspace, `packages/tsconfig`,
  `packages/eslint-config`; versions pinned in ADR-0007 (TypeScript held at 6.0.3).
- `monorepo-foundation.T02` completed: buildable skeletons for `contracts`, `design-tokens`,
  `sections`.
- `monorepo-foundation.T03` completed on branch `feat/foundation-t03-api-bootstrap`:
  `apps/api` workspace, `config/env.ts`, `ILogger` + `JsonLogger`, `MongoConnection`
  singleton, `ApplicationLifecycle`, `main.ts` startup and graceful shutdown (AC2, AC3, AC13).
- `monorepo-foundation.T04` completed on branch `feat/foundation-t04-http-core`: `AppError`
  hierarchy, `respond` helpers, `validate()`, `notFound`, `errorHandler`, JSON body limit
  (AC6, AC7, AC8; IT08, IT09).
- `monorepo-foundation.T05` completed on branch `feat/foundation-t05-security-middleware`:
  `createSecurityHeaders` (helmet), `createRequestId`, `RateLimiterFactory` (AC11; IT06).
  Mounting on `/health` moved to T06, which creates the route.
- `monorepo-foundation.T06` completed on branch `feat/foundation-t06-health-app-openapi`:
  `health` module, `container.ts`, `app.ts`, `main.ts` serving the real app, `ApiRouter`,
  `openapi/openapi.yaml` and `pnpm drift` (AC4, AC5, AC10; AC6 and AC11 re-proven on the live
  app; IT01, IT02, IT12). `GET /api/v1/health` is the first live route.
### 2026-10-11
- All 16 specs, plans, task lists and test-case files authored from `Ghulam Portfolio.html`.
- ADR-0001 and ADR-0002 accepted by the owner; ADR-0003 accepted for the provider list;
  ADR-0004 to ADR-0007 proposed and awaiting the owner.
- No implementation started.
