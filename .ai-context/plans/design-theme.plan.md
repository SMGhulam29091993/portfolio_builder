# Plan: Design Theme
## Derived From
.ai-context/specs/design-theme.spec.md
## Architecture Approach
**`packages/design-tokens`** (pure TypeScript, no framework): `ThemeTokens`, `DesignSpec` zod
schemas; `VARIANT_CATALOGUE`; `FONT_ALLOW_LIST`; `DEFAULT_DESIGN`; `contrastRatio`,
`checkContrast`; `toCssVariables`. Used by the API for validation and by the web for rendering
and live feedback — one implementation of the contrast maths.

Module `apps/api/src/modules/design/`, module file pattern.
| Class | Layer | Implements | Depends on (interfaces) |
|---|---|---|---|
| `DesignController` | Controller | — | `IDesignService` |
| `DesignService` | Service | `IDesignService`, `IDesignReader`, `IDesignWriter` | `IDesignRepository`, `IDesignValidator` |
| `DesignValidator` | Service | `IDesignValidator` | catalogue + allow-list (constructor) |
| `DesignRepository` | Repository | `IDesignRepository` | Mongoose model |
| `DesignSeeder` | Seed | `ISeeder` | `IDesignRepository` |
- `index.ts` exports `IDesignReader`, `IDesignWriter`, `IDesignValidator` (**Interface
  Segregation** — `ai-design` gets a reader, a writer and a validator, not the whole service).
- `IDesignWriter.apply(portfolioId, design, expectedRevision)` runs the same validator as API02.
- **Web:** `ThemeStyle` server component emits `toCssVariables` into a `<style>` block scoped to
  the portfolio root; Tailwind maps utilities to those variables. `/cms/design` uses colour
  inputs with live contrast badges, font and radius selects, effect switches, variant pickers.
- A lint rule over `packages/sections` forbids hex, `rgb()` and font-family literals (AC8).
## Data Model
**`designs`** — `_id`, `portfolioId` (unique index), `revision`, `theme`, `layout`, `updatedAt`.
**Seed:** `DEFAULT_DESIGN` from `packages/design-tokens` — colours from `design_reference.md`
(pending OQ2), fonts pending OQ1.
## Constitution Check
- [x] No new datastore introduced without ADR
- [x] One writer per collection
- [x] Open/Closed: variants and fonts are catalogue entries, not branches
- [x] Contrast enforced by code at save
- [ ] Default theme is complete — blocked on OQ1 (fonts) and OQ2 (exact colours)
- [ ] Constrained-design model — pending acceptance of ADR-0006
## Explicitly Deferred
- More variants per section — the mechanism is built; content is future specs.
- Light theme / theme presets library — one design per portfolio.
- Type scale and spacing tokens — fixed in components until a second design needs them.
## Sequencing
1. `packages/design-tokens`: schemas, catalogue, contrast, CSS emitter, default
2. Model, repository
3. Validator and service
4. Controller, routes, container, OpenAPI
5. Seeder
6. `ThemeStyle`, Tailwind variable mapping, literal-ban lint rule
7. CMS design screen
