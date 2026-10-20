# Plan: Section Engine
## Derived From
.ai-context/specs/section-engine.spec.md
## Architecture Approach
Module `apps/api/src/modules/portfolio/`.
| Class | Layer | Implements | Depends on (interfaces) |
|---|---|---|---|
| `PortfolioController` | Controller | — | `ISectionService` |
| `SectionService` | Service | `ISectionService` | `IPortfolioRepository`, `ISectionRepository`, `ISectionRegistry`, `IIdGenerator` |
| `PortfolioProvisioner` | Service | `IPortfolioProvisioner` (get or create the user's portfolio and its sections; slug choice; slug change) | `IPortfolioRepository`, `ISectionRepository`, `ISectionRegistry`, `IUserDirectory` (display name, from `auth`) |
| `PortfolioRepository`, `SectionRepository` | Repository | their interfaces | Mongoose models |
| `SectionRegistry` | Strategy registry | `ISectionRegistry` | `ISectionDefinition[]` (constructor) |
| `<Type>SectionDefinition` × 6 | Strategy | `ISectionDefinition` | contract schema — **added by each section spec, not here** |
| `ResolvePortfolioMiddleware` | HTTP | its `handle` is the `resolvePortfolio` handler | `IPortfolioProvisioner` |
| `CryptoIdGenerator` | Adapter | `IIdGenerator` | — (Node `crypto`, 9 random bytes → 12 base64url characters; no `nanoid` dependency) |
| `PortfolioSeeder`, `SectionSeeder` | Seed | `ISeeder` (since `owner-auth.T09`; built in `container.ts` → `buildSeeders`) | repositories, `ISectionRegistry`, seed-data loader |

```typescript
interface ISectionDefinition<T = unknown> {
  readonly type: SectionType;
  readonly label: string;
  readonly orderable: boolean;
  readonly hideable: boolean;
  readonly inNav: boolean;
  readonly schema: ZodType<T>;      // from packages/contracts
  defaults(): T;                    // must satisfy schema — checked at startup
}
```
- The registry receives its definitions through the constructor from `container.ts`; adding a
  type is one new class and one line in the container's definition list (**Strategy + Registry**).
- `index.ts` exports `IPortfolioResolver`, `ISectionReader` (read-only, for later consumers) and
  types. `IPublishedPointerWriter` is added by `publish-pipeline`, not here.
- **Web:** `packages/sections` gets `SectionRendererRegistry` (type + variant → component) and
  `PortfolioPage`, the composer that orders, filters and numbers sections. Renderers are added
  by the section specs.
- `IIdGenerator` (nanoid adapter) is injected so item-id assignment is testable.
## Data Model
**`portfolios`** — `_id`, `userId` (unique index; ADR-0010), `slug` (unique index),
`sectionOrder: string[]`, `revision`, `createdAt`, `updatedAt`. (`publishedSnapshotId`, `publishedVersion` are
added by `publish-pipeline`.)
**`sections`** — `_id`, `portfolioId`, `type`, `visible`, `revision`, `data` (validated by the
type's schema, stored as a sub-document), `updatedAt`. Unique compound index
`{ portfolioId, type }`.
**Seed:** `apps/api/src/seed/data/sections/<type>.ts`, one file per type, each transcribed from
`design_reference.md` by its section spec, holding the owner's reference content. `seed:all`
runs the owner seeder, then the portfolio seeder (the development account's portfolio with slug
from `seed/data/portfolio.ts`), then the section seeder; each inserts only when absent.
- Module edge: `portfolio → auth` (`IUserDirectory`, read-only display name) — already allowed
  by the map (every `/cms` module may depend on `auth`).
## Constitution Check
- [x] No new datastore introduced without ADR
- [x] One writer per collection (`portfolio` → `portfolios`, `sections`)
- [x] Open/Closed via registry; AC10 tests it
- [x] Free text sanitised through the shared `plainText` helper
- [x] Reference content is seed data, not literals in services or components
- [x] Section model — ADR-0005 accepted 2026-10-20
- [x] Tenant isolation: every query filters by the resolved `portfolioId`; no route takes one
## Explicitly Deferred
- Multiple instances of one section type — would re-key sections by id (ADR-0005 consequence).
- Draft history / undo — snapshots cover published history only.
- Section duplication or templates — no requirement.
## Sequencing
1. Contract primitives and engine request/response schemas
2. Models and repositories
3. `plainText`, `ISectionDefinition`, `SectionRegistry`
4. `SectionService`
5. Controller, routes, `resolvePortfolio`, container, OpenAPI
6. Seeder orchestration and portfolio seeder
7. Web renderer registry and page composer
