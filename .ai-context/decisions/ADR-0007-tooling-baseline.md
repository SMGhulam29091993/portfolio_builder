# ADR-0007: Tooling baseline
**Status:** Accepted — owner, 2026-10-15 (accepted as proposed, no line changed)

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
| Unit + integration tests | Vitest, Supertest, `mongodb-memory-server` | Proposed |
| E2E + visual tests | Playwright with axe | Proposed |
| Styling / motion | Tailwind, Motion | Named in the reference design's footer |
| CMS data + forms | TanStack Query, react-hook-form, Zustand for UI state | TanStack Query and Zustand are in the owner's résumé stack |
| File storage | MongoDB GridFS behind `IFileStorage` | Keeps MongoDB the only datastore |
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
| zod | 4.6.7 | `monorepo-foundation.T03` | `apps/api`; `packages/contracts` adopts it with its first schema |
| vitest | 5.0.5 | `monorepo-foundation.T03` | Coverage provider added by T09 |
| mongodb-memory-server | 11.3.0 | `monorepo-foundation.T03` | Downloads `mongod` 8.2.6 at install (`allowBuilds` in `pnpm-workspace.yaml`) |
| tsx | 4.23.15 | `monorepo-foundation.T03` | Runs `src/main.ts` in `dev` and in process-level tests |
| @types/node | 24.19.2 | `monorepo-foundation.T03` | Major tracks the Node.js runtime (24) |

**TypeScript is held at 6.0.x.** On 2026-10-15 the `latest` TypeScript was 7.0.2, but
typescript-eslint 8.71.2 declares `typescript: >=4.8.4 <6.1.0`. The type-aware lint rules and
the import-boundary rules (`monorepo-foundation.T07`) depend on typescript-eslint, so TypeScript
moves to 7.x only when a typescript-eslint release supports it.

## Consequences
- Versions are pinned exactly (table above); an upgrade is a deliberate change to that table.
- GridFS keeps infrastructure to one datastore; moving to object storage later is a new adapter
  plus an ADR.
- `mongodb-memory-server` runs a real `mongod`, satisfying the "no mocked data layer" rule.
