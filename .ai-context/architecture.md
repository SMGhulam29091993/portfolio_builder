# Architecture — Portfolio Builder

Living system design. States current truth in plain present tense. The *why* behind a choice
lives in `decisions/`; the constraints live in `.agent/rules/constitution.md`.

**Directory-status legend:** ✅ built · 🚧 in progress · ⬜ planned (specified, not built).
The tree below marks each path's current state; `monorepo-foundation` T01–T07 are built, so
the workspace, the API core, the `health` module and the boundary checks exist, while
`apps/web` and every feature module are ⬜ planned.

## System overview
The owner signs in to a CMS panel, edits portfolio content section by section, adjusts or
AI-generates the visual design, previews at 1440 and 390, and publishes. Publishing freezes the
draft into an immutable snapshot; the public site renders only the current snapshot.

```
 Browser (owner) ──► apps/web (cms) ──/api/v1 rewrite──► apps/api ──► MongoDB
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
│   │   ├── openapi/openapi.yaml  ✅ OpenAPI 3.1; `pnpm drift` compares it with the mounted routes
│   │   └── src/
│   │       ├── main.ts           ✅ startup sequence — env → MongoDB → container + app → listen → graceful shutdown
│   │       ├── app.ts            ✅ Express app factory (middleware + router mounts + route table)
│   │       ├── container.ts      ✅ composition root — the only place classes are instantiated
│   │       ├── config/env.ts     ✅ zod-validated environment
│   │       ├── core/             🚧 db ✅ · logger ✅ · lifecycle ✅ · errors ✅ · http (respond, validate, notFound, errorHandler, JSON body, security headers, request id, `RateLimiterFactory`, `ApiRouter`) ✅ · events ⬜
│   │       ├── openapi/          ✅ drift check (dev tooling, excluded from the build)
│   │       ├── architecture/     ✅ architecture test + allowed-edge table (dev tooling, excluded from the build)
│   │       ├── modules/          🚧 one folder per module (table below) — `health` ✅
│   │       ├── seed/             ⬜ idempotent seeders + seed data
│   │       └── testing/          ⬜ fixture factories, in-memory fakes, Mongo test harness
│   │   └── test-fixtures/        ✅ deliberate boundary violations, linted only by the boundary-lint spec
│   └── web/                      ⬜ Next.js App Router
│       ├── e2e/                  ⬜ Playwright
│       └── src/app/{(site),(cms)/cms,api/revalidate}
├── packages/
│   ├── contracts/                🚧 zod schemas + inferred types (API + section payloads) — skeleton
│   ├── sections/                 🚧 React section renderers + variant registry — skeleton
│   ├── design-tokens/            🚧 ThemeTokens, default theme, CSS-variable emitter, contrast — skeleton
│   ├── eslint-config/            ✅ shared lint rules — baseline (`base.js`); API boundary rules (`api.js`, `plugin/`)
│   └── tsconfig/                 ✅ shared strict TypeScript config (`base`, `node`, `library`, `react-library`)
├── docs/design-reference/        ✅ the two reference boards
├── .agent/  .ai-context/         ✅ this system
└── turbo.json · package.json · pnpm-workspace.yaml   ✅
```
`.agent/` and `.ai-context/` sit at the repository root and are shared by every app (ADR-0002).

## API modules
| Module | Responsibility | Collections it writes | Owning spec |
|---|---|---|---|
| `health` | Liveness + DB reachability | — | `monorepo-foundation` |
| `auth` | Owner login, sessions, the `requireOwner` guard | `users`, `auth_sessions` | `owner-auth` |
| `portfolio` | Portfolio aggregate, section registry, section CRUD, order, visibility | `portfolios`, `sections` | `section-engine` |
| `identity` | Name, monogram, contact, socials, résumé link, footer, SEO | `identities` | `site-identity` |
| `assets` | Upload, list, delete, serve files | `assets` + GridFS `asset_files.*` | `media-assets` |
| `design` | Theme tokens + per-section layout variant | `designs` | `design-theme` |
| `ai-design` | Design proposals; provider adapters | `design_proposals` | `ai-design-studio` |
| `publishing` | Validate, snapshot, activate, rollback, revalidate | `snapshots`, `portfolios.published*` ¹ | `publish-pipeline` |
| `public-site` | Read-only delivery of the current snapshot | — | `public-site-rendering` |

¹ `publishing` does not touch the `portfolios` collection directly. It calls
`IPublishedPointerWriter` / `IPublishedPointerReader`, interfaces it owns and `portfolio`
implements, so `portfolio` remains the collection's single writer.

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
publishing  → core, portfolio (IPublishedPointerWriter, IPublishedPointerReader), assets (IAssetLookup; implements
              assets' IAssetReferenceProvider), design (IDesignValidator)
portfolio, identity, design → publishing's IDraftContributor (each implements it; the
              interface is owned by publishing and injected as a list by the container)
public-site → core, publishing (ISnapshotReader), assets (IAssetReader)
every /cms router → auth (requireOwner) and portfolio (resolvePortfolio) middleware,
                    both injected by the container
```
`IDraftContributor`, `IPublishRule`, `IPublishStep` are owned by `publishing`;
`IAssetReferenceProvider` by `assets`. The consuming module owns the interface it depends on.

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
| `users` | `auth` | The owner account; password hash |
| `auth_sessions` | `auth` | Hashed refresh tokens, rotation family, expiry (TTL index) |
| `portfolios` | `portfolio` | One per owner: slug, `sectionOrder`, `revision`, published pointer |
| `sections` | `portfolio` | One document per section type: `data`, `visible`, `revision` |
| `identities` | `identity` | One per portfolio |
| `designs` | `design` | One per portfolio: `theme`, `layout`, `revision` |
| `design_proposals` | `ai-design` | AI proposals and their status |
| `snapshots` | `publishing` | Immutable published content, versioned per portfolio |
| `assets`, `asset_files.files`, `asset_files.chunks` | `assets` | File metadata + GridFS bytes |

Every content document carries `portfolioId`. A single owner and a single portfolio exist today.

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
`helmet` → request id → JSON body → [module router: rate limiter] → Origin allow-list (non-GET) →
`requireOwner` (auth: verifies the access cookie, attaches `userId`) → `resolvePortfolio`
(portfolio: attaches `portfolioId`) → `validate(schema)` → controller → service → repository → envelope → error middleware.

Rate limiters are per mount, so they run inside each module's router, after the global JSON body
parser; the 100 KiB body limit bounds the cost of parsing before a limiter can reject. Every
module router is an `ApiRouter`, so the app knows its mounted route table for the OpenAPI drift
check (`apps/api/src/app.ts`).

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
| Variable | App | Purpose |
|---|---|---|
| `NODE_ENV`, `PORT` | api | Runtime |
| `MONGODB_URI` | api | Datastore |
| `WEB_ORIGIN` | api | Origin allow-list for CMS writes |
| `JWT_ACCESS_SECRET` | api | Signs the access token |
| `OWNER_EMAIL`, `OWNER_PASSWORD` | api (seed only) | Creates the owner account |
| `DEFAULT_PORTFOLIO_SLUG` | api | Which portfolio `/public` serves |
| `AI_PROVIDER` | api | `gemini` \| `openrouter` \| `ollama`; unset outside production → stub |
| `AI_MODEL` | api | Model ID for the chosen provider — never a code literal |
| `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `OLLAMA_BASE_URL` | api | Provider access |
| `AI_TIMEOUT_MS`, `AI_DAILY_PROPOSAL_LIMIT` | api | AI bounds |
| `WEB_REVALIDATE_URL`, `REVALIDATE_SECRET` | api, web | Publish → site revalidation |
| `API_INTERNAL_URL`, `NEXT_PUBLIC_SITE_URL` | web | Server-side fetch target; canonical URL |
