# Project Status Board
_Last updated: 2026-10-17_

Lifecycle: `Draft → Ready → In Progress → Implemented → Released` (`governance.md`). Only the
owner moves a spec to `Ready`.

## Active Specs
| # | Spec ID | Title | Status | BRD | Blocked on before `Ready` |
|---|---|---|---|---|---|
| 1 | `monorepo-foundation` | Turborepo, API bootstrap, shared packages | Implemented | BRD-007 | — |
| 2 | `owner-auth` | Owner sign-in, the single Redis session, password reset by one-time code | Draft | BRD-002 | — (revised 2026-10-17; DoR self-check passes, awaiting the owner) |
| 3 | `section-engine` | Section registry and draft content engine | Draft | BRD-001 | ADR-0005 |
| 4 | `cms-panel-shell` | CMS layout, editor host, live preview | Draft | BRD-001 | — |
| 5 | `site-identity` | Name, contact, socials, résumé link, footer, SEO | Draft | BRD-001 | OQ1 link targets, OQ2 SEO text |
| 6 | `media-assets` | Résumé and image uploads | Draft | BRD-006 | — |
| 7 | `design-theme` | Theme tokens and layout variants | Draft | BRD-003 | OQ1 fonts, OQ2 accent; ADR-0006 |
| 8 | `hero-section` | Hero, code card, tech marquee | Draft | BRD-001 | OQ1 clipped values, OQ2 marquee motion |
| 9 | `about-section` | Bio, currently, stats, process | Draft | BRD-001 | — |
| 10 | `work-showcase` | Featured project and project cards | Draft | BRD-001 | — (OQ1 Second Brain copy blocks the first publish, not `Ready`) |
| 11 | `experience-timeline` | Role timeline | Draft | BRD-001 | — |
| 12 | `stack-credentials` | Skills, education, certifications | Draft | BRD-001 | — |
| 13 | `contact-section` | Contact card | Draft | BRD-001 | — |
| 14 | `publish-pipeline` | Validate, snapshot, publish, rollback | Draft | BRD-005 | ADR-0004 |
| 15 | `public-site-rendering` | Public site shell, SEO, fidelity | Draft | BRD-003 | OQ1 mobile nav, OQ2 motion |
| 16 | `ai-design-studio` | AI design proposals | Draft | BRD-004 | ADR-0006, ADR-0003 mechanics |

`OQ<n>` refers to the numbered Open Questions section of that spec.

## Daily Execution Log
### 2026-10-17
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
