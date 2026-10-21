# ADR-0007: Tooling baseline
**Status:** Accepted — owner, 2026-10-15 (accepted as proposed, no line changed). Amended
2026-10-17 by the owner: bcrypt, Redis and nodemailer rows added for `owner-auth`.

## Context
`constitution.md` requires actual tooling choices to be recorded rather than assumed. The
owner fixed the stack (Next.js, Node.js + Express, TypeScript, MongoDB, Turborepo). The
reference design's footer names Tailwind and Motion. The rest is unspecified.

## Decision
| Concern | Choice | Basis |
|---|---|---|
| Package manager | pnpm workspaces | Proposed |
| HTTP framework | Express 5 | Owner chose Express; v5 for native async error propagation |
| ODM | Mongoose | Listed in the owner's résumé stack |
| Validation / contracts | zod, shared via `packages/contracts` | Proposed |
| Password hashing | argon2id | Proposed |
| One-time-code and reference hashing | bcrypt, cost 10 | Owner, 2026-10-17 (`owner-auth` → Password reset). Passwords stay on argon2id |
| Session and reference store | Redis | Owner, 2026-10-17 — ADR-0008 |
| Mail | nodemailer (Gmail SMTP) behind `IMailSender` | Owner, 2026-10-17 — ADR-0009 |
| Unit + integration tests | Vitest, Supertest, `mongodb-memory-server` | Proposed |
| E2E + visual tests | Playwright with axe | Proposed |
| Styling / motion | Tailwind, Motion | Named in the reference design's footer |
| CMS data + forms | TanStack Query, react-hook-form, Zustand for UI state | TanStack Query and Zustand are in the owner's résumé stack |
| File storage | MongoDB GridFS behind `IFileStorage` | Keeps files in MongoDB, with no object store |
| Coverage floor | 80% lines and branches on API services | Proposed |

## Pinned versions
Exact versions, no range prefixes (`pnpm-workspace.yaml` sets `savePrefix: ''`). Each later task
appends the tools it installs to this table in the same change.
| Tool | Version | Pinned by | Note |
|---|---|---|---|
| Node.js | ≥ 24.12.0 (`engines`) | `monorepo-foundation.T01` | Local runtime at pin time: 24.12.0 |
| pnpm | 11.1.2 (`packageManager`) | `monorepo-foundation.T01` | |
| turbo | 2.11.8 | `monorepo-foundation.T01` | |
| typescript | 6.0.3 | `monorepo-foundation.T01` | **Not 7.x** — see below |
| eslint | 10.12.0 | `monorepo-foundation.T01` | |
| typescript-eslint | 8.71.2 | `monorepo-foundation.T01` | |
| @eslint/js | 10.0.1 | `monorepo-foundation.T01` | |
| globals | 17.13.0 | `monorepo-foundation.T01` | |
| mongoose | 9.11.2 | `monorepo-foundation.T03` | `apps/api` |
| zod | 4.6.7 | `monorepo-foundation.T03` | `apps/api`; `packages/contracts` adopts it with its first schema; `apps/web` from T08 |
| vitest | 5.0.5 | `monorepo-foundation.T03` | Coverage provider added by T09; `apps/web` unit tests from T08 |
| mongodb-memory-server | 11.3.0 | `monorepo-foundation.T03` | Downloads `mongod` 8.2.6 at install (`allowBuilds` in `pnpm-workspace.yaml`); `apps/web` E2E harness from T08 |
| tsx | 4.23.15 | `monorepo-foundation.T03` | Runs `src/main.ts` in `dev` and in process-level tests |
| @types/node | 24.19.2 | `monorepo-foundation.T03` | Major tracks the Node.js runtime (24); also `apps/web` |
| express | 5.3.0 | `monorepo-foundation.T04` | `apps/api` |
| @types/express | 5.0.6 | `monorepo-foundation.T04` | |
| supertest | 7.3.1 | `monorepo-foundation.T04` | HTTP-level tests |
| @types/supertest | 7.2.1 | `monorepo-foundation.T04` | |
| helmet | 8.3.0 | `monorepo-foundation.T05` | Security headers, defaults unchanged |
| yaml | 2.9.1 | `monorepo-foundation.T06` | Dev only: reads `openapi.yaml` in the drift check |
| next | 16.4.2 | `monorepo-foundation.T08` | `apps/web`; Turbopack for dev and build |
| react, react-dom | 19.3.1 | `monorepo-foundation.T08` | |
| @types/react, @types/react-dom | 19.3.0 | `monorepo-foundation.T08` | |
| tailwindcss, @tailwindcss/postcss | 4.3.3 | `monorepo-foundation.T08` | v4: configured in CSS, no `tailwind.config` |
| @playwright/test | 1.64.1 | `monorepo-foundation.T08` | E2E01 uses the `request` fixture, so no browser download yet; axe arrives with the first UI task |
| @vitest/coverage-v8 | 5.0.5 | `monorepo-foundation.T09` | `apps/api`; matches vitest exactly (peer) |
| actions/checkout | v7.0.1 (`3d3c42e`) | `monorepo-foundation.T09` | CI; pinned by commit SHA |
| actions/setup-node | v7.1.0 (`949feb2`) | `monorepo-foundation.T09` | CI; Node 24.12.0 |
| pnpm/action-setup | v6.1.0 (`ea17c68`) | `monorepo-foundation.T09` | CI; pnpm from `packageManager` |
| mongo (Docker image) | 8.2.6 (`sha256:9690b26`) | `monorepo-foundation.T10` | `docker-compose.dev.yml`, local development only; pinned by image-index digest; tracks the `mongod` version `mongodb-memory-server` downloads |
| @redis/client | 6.3.0 | `owner-auth.T01` | `apps/api`; the core of the official `redis` package without the module add-ons (JSON, search, bloom, time series), which nothing uses |
| argon2 | 0.45.1 | `owner-auth.T03` | `apps/api`; native with bundled prebuilds (`allowBuilds` in `pnpm-workspace.yaml`); argon2id m=64 MiB, t=3, p=4 pinned in `Argon2PasswordHasher` |
| bcryptjs | 3.0.3 | `owner-auth.T03` | `apps/api`; pure JavaScript, ships its own types; cost 10 for one-time codes and references |
| jose | 6.2.12 | `owner-auth.T03` | `apps/api`; HS256 access tokens, algorithm pinned on verify |
| nodemailer | 10.1.2 | `owner-auth.T07` | `apps/api`; ships its own types; Gmail SMTP through its well-known `Gmail` service entry, plain text only (ADR-0009) |
| smtp-server | 3.19.23 | `owner-auth.T07` | `apps/api` dev only; the local SMTP server the `IMailSender` contract suite (`owner-auth.CT06`) sends to, so no test sends real mail |
| @types/smtp-server | 3.5.13 | `owner-auth.T07` | `apps/api` dev only; smtp-server ships no types |
| react, react-dom, @types/react, @types/react-dom, vitest in `packages/sections` | same pins as `apps/web` (19.3.1, 19.3.0, 5.0.5) | `section-engine.T07` | React is a peer dependency of `packages/sections`; component tests render with `react-dom/server`, so no DOM testing library is added |
| @tanstack/react-query | 5.104.1 | `cms-panel-shell.T01` | `apps/web`; CMS server state. Chosen as the newest release at least two weeks old on 2026-10-20 (supply-chain margin), as are the next four rows |
| react-hook-form | 7.89.0 | `cms-panel-shell.T01` | `apps/web`; CMS forms |
| @hookform/resolvers | 5.9.1 | `cms-panel-shell.T01` | `apps/web`; the zod resolver, so forms validate with the API's own contract schemas |
| zustand | 5.0.15 | `cms-panel-shell.T01` | `apps/web`; cross-component CMS UI state only (preview viewport, unsaved-changes registry) |
| smtp-server, @types/smtp-server in `apps/web` | 3.19.23, 3.5.13 | `cms-panel-shell.T08` | dev only; the E2E harness's local SMTP server (same pins as `apps/api`) |
| Playwright Chromium | the build @playwright/test 1.64.1 expects (headless shell v1248) | `cms-panel-shell.T08` | installed by `playwright install --with-deps chromium` in CI; locally once by hand |
| @axe-core/playwright | 4.13.0 | `cms-panel-shell.T01` | `apps/web` dev only; accessibility checks in E2E (`cms-panel-shell.AC14`) |
| busboy, @types/busboy | 1.6.0, 1.5.4 | `media-assets.T05` | `apps/api`; streaming multipart on the upload route only |
| redis (Docker image) | 8.10.2 (`sha256:2c2dff7`) | `owner-auth.T01` | `docker-compose.dev.yml` and the CI service container — the same digest in both, so tests run against one server version |

**TypeScript is held at 6.0.x.** On 2026-10-15 the `latest` TypeScript was 7.0.2, but
typescript-eslint 8.71.2 declares `typescript: >=4.8.4 <6.1.0`. The type-aware lint rules and
the import-boundary rules (`monorepo-foundation.T07`) depend on typescript-eslint, so TypeScript
moves to 7.x only when a typescript-eslint release supports it.

## Consequences
- Versions are pinned exactly (table above); an upgrade is a deliberate change to that table.
- GridFS keeps file storage in MongoDB (Redis, added by ADR-0008, holds auth sessions only);
  moving to object storage later is a new adapter
  plus an ADR.
- `mongodb-memory-server` runs a real `mongod`, satisfying the "no mocked data layer" rule.
