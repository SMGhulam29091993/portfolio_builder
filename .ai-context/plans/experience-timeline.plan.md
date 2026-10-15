# Plan: Experience Timeline
## Derived From
.ai-context/specs/experience-timeline.spec.md
## Architecture Approach
A section type is four registrations and no engine edits (`architecture.md` → Section type
catalogue; `section-engine.AC10`):
1. **Contract** — `packages/contracts/src/sections/experience.ts` exports the `ExperienceSectionData`
   schema and type.
2. **API** — `apps/api/src/modules/portfolio/sections/experience.definition.ts`:
   `ExperienceSectionDefinition implements ISectionDefinition`, added to the container's definition
   list (one line).
3. **Renderer** — `packages/sections/src/experience/timeline.tsx`, registered under variant id
   `timeline`; pure props-in, markup-out.
4. **Editor** — `apps/web/src/app/(cms)/cms/sections/_editors/experience.tsx`, registered in the
   editor registry; declares fields only, the host owns load / save / conflict.
- Supporting pieces:
  - `sortEntries`, `formatRange` — pure functions in `packages/sections/src/experience/dates.ts`; month abbreviations are a constant there
  - `TimelineEntry` — marker, connecting line, date column, body
  - `MonthYearField` — CMS form control added to the shell form kit
- Ordering is derived in the renderer. The API stores entries in list order and does not sort.
- Patterns: Strategy + Registry on both sides — from the approved list.
## Data Model
No new collection. One `sections` document with `type: "experience"`, `data` validated by the
schema above. **Seed:** `apps/api/src/seed/data/sections/experience.json`, transcribed from
`design_reference.md`; inserted only when the document is absent.
## Constitution Check
- [x] No new datastore introduced without ADR
- [x] Open/Closed: nothing in `SectionService`, its routes, the page composer or the editor host is edited
- [x] No business payload hardcoded — reference content is seed data
- [x] No colour, radius or font literal in the renderer (`design-theme.AC8`)
- [x] Accessibility and reduced motion covered by acceptance criteria
## Explicitly Deferred
- Company links and logos — none in the reference.
- Localised month names.
- Collapsing older roles behind "Show more".
## Sequencing
1. Contract schema `experience.ts`
2. `dates.ts`
3. `experience/timeline.tsx` with `TimelineEntry`
4. `MonthYearField` in the form kit; experience editor with "Current role" switch and highlights list; register
5. Visual baselines at 1440 and 390, axe check
