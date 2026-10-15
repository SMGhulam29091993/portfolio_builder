# Plan: Work Showcase
## Derived From
.ai-context/specs/work-showcase.spec.md
## Architecture Approach
A section type is four registrations and no engine edits (`architecture.md` → Section type
catalogue; `section-engine.AC10`):
1. **Contract** — `packages/contracts/src/sections/work.ts` exports the `WorkSectionData`
   schema and type.
2. **API** — `apps/api/src/modules/portfolio/sections/work.definition.ts`:
   `WorkSectionDefinition implements ISectionDefinition`, added to the container's definition
   list (one line).
3. **Renderer** — `packages/sections/src/work/featured-grid.tsx`, registered under variant id
   `featured-grid`; pure props-in, markup-out.
4. **Editor** — `apps/web/src/app/(cms)/cms/sections/_editors/work.tsx`, registered in the
   editor registry; declares fields only, the host owns load / save / conflict.
- Supporting pieces:
  - `FeaturedProjectCard` — two-column card with `MetricPanel` (2 × 2)
  - `ProjectCard` — category, title, description, inline metrics, bottom-pinned `TagList`, optional `ExternalLinkButton`
  - `TagList`, `MetricPanel` — in `packages/sections/src/shared/`
  - `projectRules.ts` — pure functions for the one-featured rule and metric limits, used by both the schema refinement and the editor reducer
- The one-featured and metric-limit rules live in one place (`projectRules.ts` in `packages/contracts`) and are imported by the schema and the editor — never implemented twice.
- Patterns: Strategy + Registry on both sides — from the approved list.
## Data Model
No new collection. One `sections` document with `type: "work"`, `data` validated by the
schema above. **Seed:** `apps/api/src/seed/data/sections/work.json`, transcribed from
`design_reference.md`; inserted only when the document is absent.
## Constitution Check
- [x] No new datastore introduced without ADR
- [x] Open/Closed: nothing in `SectionService`, its routes, the page composer or the editor host is edited
- [x] No business payload hardcoded — reference content is seed data
- [x] No colour, radius or font literal in the renderer (`design-theme.AC8`)
- [x] Accessibility and reduced motion covered by acceptance criteria
- [ ] Seed content is publishable — blocked on OQ1 (Second Brain description); it is stored as-is and stopped at publish
## Explicitly Deferred
- Project detail pages — out of scope in the spec.
- Project images — none in the reference.
- Drag between featured and grid — featuring is a switch.
## Sequencing
1. `projectRules.ts`, contract schema `work.ts`, `WorkSectionDefinition`, container registration, `seed/data/sections/work.json`
2. Shared `TagList`, `MetricPanel`, `ExternalLinkButton`
3. `work/featured-grid.tsx` with `FeaturedProjectCard` and `ProjectCard`
4. Work editor
5. Visual baselines at 1440 and 390, axe check
