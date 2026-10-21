# Plan: Design Library
## Derived From
.ai-context/specs/design-library.spec.md
## Architecture Approach
- `packages/design-tokens`: `customLayoutSchema` (fixed depth), `LAYOUT_BLOCKS` (block catalogue
  per section with style options), `validateCustomLayout` (shape + exactly-once rule) and
  `isCustomLayoutRef` / `customLayoutId`; `validateDesign` accepts `custom:<id>` as a layout entry
  (existence is the API's check, since the library lives in the database).
- `packages/sections`: the section renderers' parts become named blocks; `CustomLayoutRenderer`
  draws a tree with `SectionShell` (or the hero frame) and the blocks; `PortfolioPage` takes
  `customLayouts` and uses it for `custom:` entries, else the registry (reference fallback).
- `design` module: `LayoutLibraryRepository` (`design_layouts`), `PresetRepository`
  (`design_presets`), `DesignLibraryService` (API01–API06; in-use checks; limits),
  `DesignService.apply` checks `custom:` references through `ILayoutLookup`. Ports exported for
  `ai-design`: `ILayoutLibraryWriter`, `IPresetWriter`. `DesignDraftContributor` resolves
  `customLayouts` into the snapshot.
- `publishing`: `SNAPSHOT_SCHEMA_VERSION` 2; the draft's design carries `customLayouts`.
- `ai-design`: answer schema gains `customLayouts` (each section nullable, the tree with that
  section's block enum); parser validates trees with `validateCustomLayout` and scope-merges them;
  request gains `explore`; apply saves layouts then writes the design; API07 saves a preset.
- `apps/web`: preview and site pass `customLayouts`; Design screen library and presets panel;
  AI Studio explore switch and Save as preset.
## Data Model
`design_layouts` `{ portfolioId, section, name, layout, source, createdAt }`, index
`{ portfolioId, createdAt: -1 }`. `design_presets` `{ portfolioId, name, design, createdAt }`, index
`{ portfolioId, createdAt: -1 }`. Writer of both: `design` (`architecture.md` → Data ownership).
## Constitution Check
- [x] Model output stays data (ADR-0014): trees validated, drawn by existing components only
- [x] One writer per collection (`design`); `ai-design` writes through `design`'s ports
- [x] No new dependency edge (`ai-design → design` exists)
- [x] Snapshot shape change bumps `schemaVersion` and keeps rendering version 1
## Explicitly Deferred
- Renaming, sharing, new block kinds, new hand-drawn variants.
## Sequencing
1. Tokens: schema, catalogue, validator; `validateDesign` accepts `custom:` refs
2. Sections: blocks, `CustomLayoutRenderer`, `PortfolioPage.customLayouts`
3. Design module: library + presets persistence, service, `custom:` existence check, routes, OpenAPI
4. Publishing + public site: snapshot v2 with `customLayouts`, adapter and page
5. AI: schema, parser, explore, apply-to-library, API07, OpenAPI
6. Web: preview, Design screen library + presets, AI Studio explore + Save as preset, E2E
