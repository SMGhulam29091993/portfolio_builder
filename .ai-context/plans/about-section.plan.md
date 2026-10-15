# Plan: About Section
## Derived From
.ai-context/specs/about-section.spec.md
## Architecture Approach
A section type is four registrations and no engine edits (`architecture.md` → Section type
catalogue; `section-engine.AC10`):
1. **Contract** — `packages/contracts/src/sections/about.ts` exports the `AboutSectionData`
   schema and type.
2. **API** — `apps/api/src/modules/portfolio/sections/about.definition.ts`:
   `AboutSectionDefinition implements ISectionDefinition`, added to the container's definition
   list (one line).
3. **Renderer** — `packages/sections/src/about/bento.tsx`, registered under variant id
   `bento`; pure props-in, markup-out.
4. **Editor** — `apps/web/src/app/(cms)/cms/sections/_editors/about.tsx`, registered in the
   editor registry; declares fields only, the host owns load / save / conflict.
- Supporting pieces:
  - `StatCard` — value + label; grid adapts to 1–4 items without placeholders
  - `ProcessCard` — eyebrow, title, optional note, numbered `StepItem`s (row at 1440, column at 390)
  - `SectionHeader` — eyebrow with derived number + `h2` with emphasis — shared by every non-hero section, in `packages/sections/src/shared/`
- `SectionHeader` is introduced here because `about` is the first numbered section built; later section specs reuse it and must not fork it.
- Patterns: Strategy + Registry on both sides — from the approved list.
## Data Model
No new collection. One `sections` document with `type: "about"`, `data` validated by the
schema above. **Seed:** `apps/api/src/seed/data/sections/about.json`, transcribed from
`design_reference.md`; inserted only when the document is absent.
## Constitution Check
- [x] No new datastore introduced without ADR
- [x] Open/Closed: nothing in `SectionService`, its routes, the page composer or the editor host is edited
- [x] No business payload hardcoded — reference content is seed data
- [x] No colour, radius or font literal in the renderer (`design-theme.AC8`)
- [x] Accessibility and reduced motion covered by acceptance criteria
## Explicitly Deferred
- Animated stat counters — not in the reference.
- Profile image — not in the reference.
- Icon selection for the "Currently" card — the sparkle icon is fixed.
## Sequencing
1. Contract schema `about.ts`
2. Shared `SectionHeader`
3. `about/bento.tsx` with `StatCard` and `ProcessCard`
4. About editor
5. Visual baselines at 1440 and 390, axe check
