# Architecture — Portfolio Builder

Living system design. States current truth in plain present tense. The *why* behind a choice
lives in `decisions/`; the constraints live in `.agent/rules/constitution.md`.

**Directory-status legend:** ✅ built · 🚧 in progress · ⬜ planned (specified, not built).
The tree below marks each path's current state; `monorepo-foundation` is implemented, so
the workspace, the API core (including the event bus), the `health` module, the boundary
checks, the `apps/web` scaffold (placeholder pages and the `/api/v1` proxy), the API test
harness, CI and the local development environment exist. `owner-auth` is implemented: the
Redis infrastructure, the `auth` module's persistence and adapters (T01–T03), its
`SessionAuthorizer` and `AuthService` (T04), sign-in, refresh, sign-out, `me` and the
`requireOwner` guard wired and routed (T05), the login rate limiter and the Origin allow-list
(T06), the mail port with its Gmail strategy and factory (T07), and password reset by one-time
code (T08) exist, and so does the development-only owner seeder with its `seed:owner` script
(T09, ADR-0010). `account-registration` is implemented in the same module: registration, email
verification by one-time code, roles and the one-time owner claim; and `google-sign-in`: the
OpenID Connect flow against a configured issuer (`OidcProvider`, `jose`). `section-engine` is implemented: the `portfolio`
module (one portfolio per user, provisioned on the first CMS request; the section registry and
engine; `resolvePortfolio`), `seed:all`, and the composer in `packages/sections`. The `assets` module
(`media-assets`) stores files in GridFS behind `IFileStorage`. Every other feature module is ⬜
planned.

## System overview
Each registered user signs in to the CMS panel and builds their own portfolio (ADR-0010): they
edit its content section by section, adjust or AI-generate the visual design, preview at 1440
and 390, and publish. A free portfolio is served on the platform's domain; a user with credits
can attach their own domain (BRD-011). One account, the platform owner, is claimed once with a
secret key at registration. Publishing freezes the
draft into an immutable snapshot; the public site renders only the current snapshot.

```
 Browser (user)  ──► apps/web (cms) ──/api/v1 rewrite──► apps/api ──► MongoDB
                                                      │  └──► Redis (auth sessions, ADR-0008)
                                                      ├─────► Gmail SMTP (one-time codes, ADR-0009)
                                                      └─────► Google OpenID Connect (sign-in, ADR-0011)
 Browser (visitor) ─► apps/web (site) ─server fetch────► apps/api /public ─► snapshots
                          ▲                                   │
                          └── POST /api/revalidate ◄── portfolio.published event
                                                  apps/api ──► Gemini | OpenRouter | Ollama
```

## Repository layout (Turborepo, pnpm workspaces)
```
portfolio-builder/
├── apps/
│   ├── api/                      🚧 Express + TypeScript + Mongoose
│   │   ├── .env.example          ✅ every API variable of Environment (below); copy to `.env`
│   │   ├── openapi/openapi.yaml  ✅ OpenAPI 3.1; `pnpm drift` compares it with the mounted routes
│   │   └── src/
│   │       ├── main.ts           ✅ startup sequence — env → MongoDB → Redis → container + app → listen → graceful shutdown; a container that cannot be built (production without a mail strategy) closes both datastores again
│   │       ├── app.ts            ✅ Express app factory (middleware + router mounts + route table)
│   │       ├── container.ts      ✅ composition root — the only place classes are instantiated
│   │       ├── config/env.ts     ✅ zod-validated environment (`env-example.spec.ts` keeps `.env.example` in step)
│   │       ├── core/             🚧 db ✅ · redis (`RedisConnection`, `IRedisClientProvider`, `whileRedisAvailable`) ✅ · crypto (`sha256Hex`) ✅ · logger ✅ · lifecycle ✅ · errors ✅ · http (respond, validate, notFound, errorHandler, JSON body, security headers, request id, `RateLimiterFactory`, `OriginAllowListMiddleware`, `ApiRouter`, `parseCookieHeader`) ✅ · events (`IEventBus`, `InProcessEventBus`) ✅
│   │       ├── openapi/          ✅ drift check (dev tooling, excluded from the build)
│   │       ├── architecture/     ✅ architecture test + allowed-edge table (dev tooling, excluded from the build)
│   │       ├── modules/          🚧 one folder per module (table below) — `health` ✅ · `auth` ✅ (persistence: `users`, `otps`, Redis session + reference stores; `adapters/`: argon2id, bcrypt, JWT, random, clock, mail (`GmailMailSender`, `DisabledMailSender`, `MailSenderFactory`); services: `SessionAuthorizer`, `AuthService`, `PasswordResetService`; HTTP: `AuthController`, `auth.routes.ts` (API01–API07), `RequireOwnerMiddleware`, `SessionCookieWriter`)
│   │       ├── seed/             🚧 idempotent seeders behind `ISeeder`, built by `buildSeeders` in `container.ts` — `OwnerSeeder` + `seed-owner.ts` (`pnpm seed:owner`, development only; refuses in production) ✅ · `data/` (`DEV_OWNER`) ✅; the reference portfolio content seeder ⬜ `section-engine`
│   │       └── testing/          ✅ `MongoTestHarness`, `RedisTestHarness`, `FixtureFactory` base, `RecordingLogger`; `auth/` fakes and factories, including `RecordingMailSender` (test-only, excluded from the build)
│   │   └── test-fixtures/        ✅ deliberate boundary violations, linted only by the boundary-lint spec
│   └── web/                      🚧 Next.js App Router + Tailwind v4 — scaffold
│       ├── .env.example          ✅ every web variable of Environment (below); copy to `.env`
│       ├── next.config.ts        ✅ `/api/v1/:path*` rewrite to `API_INTERNAL_URL`
│       ├── e2e/                  ✅ Playwright (Chromium); `start-api.ts` boots a throwaway MongoDB, seeds the development account, runs a local SMTP server + mailbox for one-time codes, then the built API (Redis database 15)
│       └── src/
│           ├── lib/env.ts        ✅ zod-validated environment (server-only; `env-example.spec.ts` alongside)
│           ├── lib/api/          ✅ `ApiClient` (envelope, cross-tab refresh rule) + TanStack Query hooks (`auth`, `portfolio`)
│           ├── lib/cms/          ✅ pure CMS rules: `safeNext`, messages, nav order, reorder, preview model, schema limits; Zustand UI store
│           ├── components/cms/   ✅ UI kit, form kit, panel frame, editor host + registry, overview, preview pane
│           └── app/              🚧 `(site)` ✅ placeholder · `(cms)/cms` ✅ — `(auth)` login, register, verify, forgot-password; `(panel)` overview, `sections/[type]`, area mount points; noindex · `api/revalidate` ⬜
├── packages/
│   ├── contracts/                🚧 zod schemas + inferred types (API + section payloads) — `health` ✅ · `auth` ✅ · `common` (`plainText`) ✅ · `sections` (primitives, engine) ✅
│   ├── sections/                 🚧 React section renderers + variant registry — `SectionRendererRegistry`, `PortfolioPage` composer ✅; renderers ⬜ the section specs
│   ├── design-tokens/            🚧 ThemeTokens, default theme, CSS-variable emitter, contrast — skeleton
│   ├── eslint-config/            ✅ shared lint rules — baseline (`base.js`); API boundary rules (`api.js`, `plugin/`)
│   └── tsconfig/                 ✅ shared strict TypeScript config (`base`, `node`, `library`, `react-library`, `nextjs`)
├── docs/design-reference/        ✅ the two reference boards
├── .agent/  .ai-context/         ✅ this system
├── .github/workflows/ci.yml      ✅ CI: build · typecheck · lint · test (coverage floor) · drift · cache check · E2E
├── docker-compose.dev.yml        ✅ local MongoDB for `pnpm dev` (development only)
├── README.md                     ✅ local development setup
├── scripts/check-turbo-cache.mjs ✅ fails if a repeated Turborepo run would not be fully cached (AC1)
└── turbo.json · package.json · pnpm-workspace.yaml   ✅
```
`.agent/` and `.ai-context/` sit at the repository root and are shared by every app (ADR-0002).

## API modules
| Module | Responsibility | Collections it writes | Owning spec |
|---|---|---|---|
| `health` | Liveness + DB reachability | — | `monorepo-foundation` |
| `auth` | Sign-in, the single Redis session per user, the `requireOwner` guard, password reset by one-time code, registration, email verification and the one-time owner claim, Google sign-in | `users`, `otps`; Redis `auth:*` keys | `owner-auth`, `account-registration`, `google-sign-in` |
| `portfolio` | Portfolio aggregate, section registry, section CRUD, order, visibility | `portfolios`, `sections` | `section-engine` |
| `identity` | Name, monogram, contact, socials, résumé link, footer, SEO | `identities` | `site-identity` |
| `assets` | Upload, list, delete, serve files | `assets` + GridFS `asset_files.*` | `media-assets` |
| `design` | Theme tokens + per-section layout variant | `designs` | `design-theme` |
| `ai-design` | Design proposals; provider adapters | `design_proposals` | `ai-design-studio` |
| `publishing` | Validate, snapshot, activate, rollback, revalidate | `snapshots`, `portfolios.published*` ¹ | `publish-pipeline` |
| `public-site` | Read-only delivery of the current snapshot | — | `public-site-rendering` |

¹ `publishing` does not touch the `portfolios` collection directly. It calls
`IPublishedPointerWriter` / `IPublishedPointerReader`, interfaces it owns and `portfolio`
implements, so `portfolio` remains the collection's single writer (ADR-0013).

## Module dependency map (allowed edges only)
An arrow reads "depends on an interface exported by". Anything not listed is forbidden.
```
health      → core
auth        → core
portfolio   → core
identity    → core, assets (IAssetLookup; implements assets' IAssetReferenceProvider)
assets      → core
design      → core
ai-design   → core, design (IDesignReader, IDesignWriter, IDesignValidator),
              portfolio (ISectionTypeLister — read-only list of visible section types)
publishing  → core, assets (IAssetLookup; implements assets' IAssetReferenceProvider)
portfolio   → publishing (implements IDraftContributor, IPublishedPointerWriter,
              IPublishedPointerReader)
identity    → publishing (implements IDraftContributor)
design      → publishing (implements IDraftContributor, IPublishDesignCheck)
public-site → core, publishing (ISnapshotReader), assets (IAssetReader)
every /cms router → auth (requireOwner) and portfolio (resolvePortfolio) middleware,
                    both injected by the container
```
`IDraftContributor`, `IPublishedPointerWriter`, `IPublishedPointerReader`,
`IPublishDesignCheck`, `IPublishRule` and `IPublishStep` are owned by `publishing`, which
imports none of the modules that implement them (ADR-0013); `IAssetReferenceProvider` is owned
by `assets`. The consuming module owns the interface it depends on.

## Boundary enforcement
The constitution's module and layer rules are checked mechanically on every `pnpm lint` and
`pnpm test` (`monorepo-foundation.AC9`):
| Check | Where | Fails when |
|---|---|---|
| `portfolio/module-boundary` | lint | a file imports another module's file other than its `index.ts` |
| `portfolio/no-framework-in-service` | lint, `*.service.ts` | a service imports `mongoose` or `express` |
| `portfolio/no-process-env` | lint | any file but `config/env.ts` reads the environment |
| `portfolio/no-instantiation-outside-container` | lint (type-aware) | a module class named `*Service` / `*Repository` / `*Controller`, or one that implements an interface, is created outside `container.ts` or a test |
| architecture test | `apps/api/src/architecture/` | the actual module-level import graph has an edge missing from the map above, a module missing from the map, or a cycle |

The lint rules live in `packages/eslint-config` (`api.js` holds every exemption as a file glob).
The architecture test reads the allowed edges from `module-dependency-map.ts`, which mirrors the
map above and changes with it. `core/` and `config/` form one `core` node that every module may
use and that may use no module.

## Data ownership
One writing module per collection. Field-level schemas live in the owning plan's Data Model.
| Collection | Writer | Purpose |
|---|---|---|
| `users` | `auth` | User accounts: password hash, `role` (`owner` \| `member`; the `one_owner` partial unique index admits one owner), `emailVerifiedAt` (`account-registration`), `googleSub` (unique, sparse; `google-sign-in`, ADR-0011); `passwordHash` is absent on a Google-only account. The development seeder writes only through `auth`'s ports |
| `otps` | `auth` | One-time codes (`password_reset`, `email_verification`): bcrypt code hash, identifier, attempts, expiry; one per user and purpose (TTL index on `purgeAt`) |
| Redis `auth:session:*`, `auth:otp-ref:*`, `auth:google-state:*` | `auth` | The one session per user (`jti`, refresh-token hash), one-time-code references, and the Google flow's PKCE verifier and nonce (10 minutes, taken once), each with a TTL (ADR-0008) |
| `portfolios` | `portfolio` | One per user (ADR-0010; `userId` unique), provisioned on the user's first CMS request: `slug` (unique; the free address `<platform>/<slug>`), `sectionOrder`, `revision`, published pointer |
| `sections` | `portfolio` | One document per section type: `data`, `visible`, `revision` |
| `identities` | `identity` | One per portfolio |
| `designs` | `design` | One per portfolio: `theme`, `layout`, `revision` |
| `design_proposals` | `ai-design` | AI proposals and their status |
| `snapshots` | `publishing` | Immutable published content, versioned per portfolio |
| `assets`, `asset_files.files`, `asset_files.chunks` | `assets` | File metadata + GridFS bytes |

Every content document carries `portfolioId`, the tenant boundary (`constitution.md` → Tenant
isolation).

## Section type catalogue
| Type | Orderable | Hideable | In nav | Payload + behaviour owned by |
|---|---|---|---|---|
| `hero` | no — always first | no | no | `specs/hero-section.spec.md` |
| `about` | yes | yes | yes | `specs/about-section.spec.md` |
| `work` | yes | yes | yes | `specs/work-showcase.spec.md` |
| `experience` | yes | yes | yes | `specs/experience-timeline.spec.md` |
| `stack` | yes | yes | yes | `specs/stack-credentials.spec.md` |
| `contact` | yes | yes | yes | `specs/contact-section.spec.md` |

A section type is four registrations and no engine edits: a contract schema, an API
`SectionDefinition`, a renderer variant, a CMS editor. Section numbers (`01`, `02`, …) are
derived at render time from the visible order; they are never stored.

## Request lifecycle (CMS write)
`helmet` → request id → JSON body → Origin allow-list (non-GET under `/auth` and `/cms`) →
[module router: rate limiter] → `requireOwner` (auth: verifies the access cookie, matches its `jti` against the `jti` cookie and
the Redis session, attaches `userId`) → `resolvePortfolio`
(portfolio: attaches `portfolioId`) → `validate(schema)` → controller → service → repository → envelope → error middleware.

`requireOwner` clears the three session cookies on `SESSION_EXPIRED` only; on `UNAUTHENTICATED`
it keeps them, because an expired access token is repaired by a refresh that needs them. While
Redis is unreachable, commands fail at once (the client's offline queue is off) and every
Redis-backed store maps the failure to 503 `SERVICE_UNAVAILABLE` (`core/redis`
`whileRedisAvailable`), so the guard and the auth routes answer 503 instead of waiting or
allowing (rule: ADR-0008).

The Origin allow-list (`core/http` `OriginAllowListMiddleware`) is mounted by the app factory on
the `/api/v1/auth` and `/api/v1/cms` prefixes ahead of every module router, so it also covers
`/cms` paths no router serves yet, and a refused request (403 `ORIGIN_NOT_ALLOWED`) never reaches
a limiter, validation or the guard (`owner-auth.AC12`, `owner-auth.T06`). GET and HEAD are not
checked.

Rate limiters are per mount, so they run inside each module's router, after the global JSON body
parser; the 100 KiB body limit bounds the cost of parsing before a limiter can reject. A policy
may count only some outcomes (`counts`): the login limiter counts 401s only, holding each slot
while the request is in flight so parallel attempts cannot overshoot (`owner-auth.AC3`). The
code-send limiter is one instance on both password-reset send routes (API05, API06), so they
share a count of 5 per hour per IP (`owner-auth.T08`). All limiters run on the container's
injected clock. Every
module router is an `ApiRouter`, so the app knows its mounted route table for the OpenAPI drift
check (`apps/api/src/app.ts`).

## In-process events
Cross-module reactions use `core/events` (Observer). A service that emits depends on
`IEventPublisher<Events>` only; handlers are classes implementing `IEventHandler` and are
subscribed in `container.ts`, which creates the one `InProcessEventBus`. `publish()` delivers to
the handlers registered when it was called, one at a time in subscription order, and resolves
once all have settled. A handler that throws is logged (event name, handler class, request id —
never the payload) and never fails the emitting operation. Events are not persisted. Each
module declares its event map in its `index.ts`; core knows no module's events.

## Draft → publish → site
1. Each content module holds its own draft document(s) with an integer `revision`.
2. `publishing` assembles the draft through `IDraftContributor[]`, builds canonical JSON with
   `SnapshotBuilder`, and hashes it (`contentHash`, SHA-256). "Unpublished changes" means the
   draft hash differs from the current snapshot's hash — no cross-module dirty flag exists.
3. `PublishPipeline` runs ordered `IPublishStep`s: validate (`IPublishRule`s) → build → persist
   the immutable snapshot → swap the published pointer in one atomic update → emit
   `portfolio.published`. No multi-document transaction is used; the pointer swap is the commit.
4. `SiteRevalidationListener` reacts to the event and calls the web app's revalidate route. A
   failure there is recorded on the snapshot and never rolls the publish back; the site also
   revalidates on a time-based fallback.
5. Rollback is the same pointer swap to an older snapshot. Snapshots are never edited or deleted.

## AI design flow
`AiDesignService` → `DesignPromptBuilder` (provider-agnostic) → `IDesignGenerator`, built by
`DesignGeneratorFactory` from configuration and wrapped by the timeout and retry decorators →
raw JSON → `DesignSpecParser` (schema validation, variant allow-list, contrast check) →
`design_proposals`. Applying a proposal goes through `IDesignWriter`; a proposal never writes
the design itself. Generation runs in-process after a `202`; proposals left `pending` by a
restart are marked `failed` during startup.

## Shared packages — one owner each
| Package | Owns | Consumed by |
|---|---|---|
| `packages/contracts` | Every request/response schema and section payload schema | `apps/api`, `apps/web`, `packages/sections` |
| `packages/design-tokens` | `ThemeTokens` type, default theme, font allow-list, contrast maths | `apps/api` (validation), `apps/web`, `packages/sections` |
| `packages/sections` | Renderers, variant registry, page composer | `apps/web` (site + CMS preview) |

## Environment
Read only by `config/env.ts` (API) and `apps/web/src/lib/env.ts` (web).
Turborepo runs in strict env mode, so a task sees only the variables `turbo.json` declares: a
variable read at build time goes in `build.env` (it then keys the cache), and every variable
an app reads in development goes in `dev.passThroughEnv`. Adding a row here adds it there in
the same change. `PORT` belongs to the API: `next dev` would also bind to it, so the web dev
script pins port 3000 explicitly.
Each app's `.env.example` (`apps/api/.env.example`, `apps/web/.env.example`) lists exactly the
rows below for that app: uncommented if the app reads the variable today, commented under the
spec that will read it. A test per app (`env-example.spec.ts`, next to each `env.ts`) fails when
an example and this table drift apart, or when the uncommented lines do not pass that app's
`loadEnv`. Local MongoDB for development comes from `docker-compose.dev.yml` (`mongo` pinned to
the `mongod` version the tests run, loopback-only, no auth); setup steps are in `README.md`.
| Variable | App | Purpose |
|---|---|---|
| `NODE_ENV`, `PORT` | api | Runtime |
| `MONGODB_URI` | api | Datastore |
| `WEB_ORIGIN` | api | The web app's origin: the only `Origin` accepted on a non-GET under `/api/v1/auth` and `/api/v1/cms` (Origin allow-list) |
| `JWT_ACCESS_SECRET` | api | Signs the access token |
| `REDIS_URL` | api | Session and one-time-code reference store (ADR-0008) |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | api | Gmail mail strategy (ADR-0009); blank or unset outside production → mail disabled (password reset 503); in production the API refuses to start, naming them |
| `MAIL_FROM` | api | Sender address (an email address); blank or unset → `GMAIL_USER`; required by the SMTP strategy |
| `SMTP_URL` | api | Generic SMTP mail strategy (ADR-0009, amended 2026-10-20): `smtp://` / `smtps://`, `user:pass@` for a login; with `MAIL_FROM`, it takes priority over Gmail. The E2E harness points it at a local SMTP server |
| `OWNER_EMAIL`, `OWNER_PASSWORD` | api (development seeder only) | `pnpm seed:owner` creates one local account from them (display name `Owner`); optional, so the API starts without them; the seeder refuses when either is unset, when the password is outside 12–200 characters, and always in production (ADR-0010) |
| `OWNER_REGISTRATION_SECRET` | api | The owner secret key: a registration carrying it while no owner exists claims the owner account (`account-registration`, ADR-0010); optional, 32–200 characters; unset keeps the claim closed |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URL` | api | Google sign-in (`google-sign-in`, ADR-0011): all three switch it on, none leaves it off (routes redirect with `google_unavailable`); some but not all fails startup |
| `GOOGLE_ISSUER` | api | The OpenID Connect issuer whose discovery document gives the endpoints; default `https://accounts.google.com` |
| `DEFAULT_PORTFOLIO_SLUG` | api | Which portfolio `/public` serves — to be revised by `public-site-rendering`, which now resolves a portfolio per request host (ADR-0010) |
| `AI_PROVIDER` | api | `gemini` \| `openrouter` \| `ollama`; unset outside production → stub |
| `AI_MODEL` | api | Model ID for the chosen provider — never a code literal |
| `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `OLLAMA_BASE_URL` | api | Provider access |
| `AI_TIMEOUT_MS`, `AI_DAILY_PROPOSAL_LIMIT` | api | AI bounds |
| `WEB_REVALIDATE_URL` | api | Publish → site revalidation: the web endpoint to call |
| `REVALIDATE_SECRET` | api, web | Publish → site revalidation: shared secret |
| `API_INTERNAL_URL`, `NEXT_PUBLIC_SITE_URL` | web | Server-side fetch target; canonical URL |
