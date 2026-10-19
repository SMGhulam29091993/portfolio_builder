# Plan: Section Engine
## Derived From
.ai-context/specs/section-engine.spec.md
## Architecture Approach
Module `apps/api/src/modules/portfolio/`.
| Class | Layer | Implements | Depends on (interfaces) |
|---|---|---|---|
| `PortfolioController` | Controller | — | `ISectionService` |
| `SectionService` | Service | `ISectionService` | `IPortfolioRepository`, `ISectionRepository`, `ISectionRegistry`, `IIdGenerator` |
| `PortfolioRepository`, `SectionRepository` | Repository | their interfaces | Mongoose models |
| `SectionRegistry` | Strategy registry | `ISectionRegistry` | `ISectionDefinition[]` (constructor) |
| `<Type>SectionDefinition` × 6 | Strategy | `ISectionDefinition` | contract schema — **added by each section spec, not here** |
| `ResolvePortfolioMiddleware` | HTTP | `IPortfolioResolver` | `IPortfolioRepository` |
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
**`portfolios`** — `_id`, `ownerId` (unique index), `slug` (unique index), `sectionOrder:
string[]`, `revision`, `createdAt`, `updatedAt`. (`publishedSnapshotId`, `publishedVersion` are
added by `publish-pipeline`.)
**`sections`** — `_id`, `portfolioId`, `type`, `visible`, `revision`, `data` (validated by the
type's schema, stored as a sub-document), `updatedAt`. Unique compound index
`{ portfolioId, type }`.
**Seed:** `apps/api/src/seed/data/sections/<type>.json`, one file per type, each transcribed from
`design_reference.md` by its section spec. Seeders insert only when the document is absent.
## Constitution Check
- [x] No new datastore introduced without ADR
- [x] One writer per collection (`portfolio` → `portfolios`, `sections`)
- [x] Open/Closed via registry; AC10 tests it
- [x] Free text sanitised through the shared `plainText` helper
- [x] Reference content is seed data, not literals in services or components
- [ ] Section model — pending acceptance of ADR-0005
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
