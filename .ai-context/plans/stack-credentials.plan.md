# Plan: Stack and Credentials
## Derived From
.ai-context/specs/stack-credentials.spec.md
## Architecture Approach
A section type is four registrations and no engine edits (`architecture.md` → Section type
catalogue; `section-engine.AC10`):
1. **Contract** — `packages/contracts/src/sections/stack.ts` exports the `StackSectionData`
   schema and type.
2. **API** — `apps/api/src/modules/portfolio/sections/stack.definition.ts`:
   `StackSectionDefinition implements ISectionDefinition`, added to the container's definition
   list (one line).
3. **Renderer** — `packages/sections/src/stack/chip-groups.tsx`, registered under variant id
   `chip-groups`; pure props-in, markup-out.
4. **Editor** — `apps/web/src/app/(cms)/cms/sections/_editors/stack.tsx`, registered in the
   editor registry; declares fields only, the host owns load / save / conflict.
- Supporting pieces:
  - `ChipGroupCard` — label + wrapping chip list
  - `EducationCard`, `CertificationCard` — list cards with dividers / nested cards
  - `formatYears` — `2019 – 2021` / `2023 – Present`
- Education order is the stored list order; unlike `experience`, nothing is sorted.
- Patterns: Strategy + Registry on both sides — from the approved list.
## Data Model
No new collection. One `sections` document with `type: "stack"`, `data` validated by the
schema above. **Seed:** `apps/api/src/seed/data/sections/stack.json`, transcribed from
`design_reference.md`; inserted only when the document is absent.
## Constitution Check
- [x] No new datastore introduced without ADR
- [x] Open/Closed: nothing in `SectionService`, its routes, the page composer or the editor host is edited
- [x] No business payload hardcoded — reference content is seed data
- [x] No colour, radius or font literal in the renderer (`design-theme.AC8`)
- [x] Accessibility and reduced motion covered by acceptance criteria
## Explicitly Deferred
- Proficiency levels and icons per chip.
- Credential verification links beyond a plain URL.
- Splitting education and certifications into their own section types — would need ADR-0005 revisited.
## Sequencing
1. Contract schema `stack.ts`
2. `stack/chip-groups.tsx` with `ChipGroupCard`
3. `EducationCard`, `CertificationCard`, `formatYears`; two-thirds / one-third row and the disabled / empty handling
4. Stack editor
5. Visual baselines at 1440 and 390, axe check
