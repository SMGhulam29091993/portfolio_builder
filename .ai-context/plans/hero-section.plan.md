# Plan: Hero Section
## Derived From
.ai-context/specs/hero-section.spec.md
## Architecture Approach
A section type is four registrations and no engine edits (`architecture.md` → Section type
catalogue; `section-engine.AC10`):
1. **Contract** — `packages/contracts/src/sections/hero.ts` exports the `HeroSectionData`
   schema and type.
2. **API** — `apps/api/src/modules/portfolio/sections/hero.definition.ts`:
   `HeroSectionDefinition implements ISectionDefinition`, added to the container's definition
   list (one line).
3. **Renderer** — `packages/sections/src/hero/split-code-card.tsx`, registered under variant id
   `split-code-card`; pure props-in, markup-out.
4. **Editor** — `apps/web/src/app/(cms)/cms/sections/_editors/hero.tsx`, registered in the
   editor registry; declares fields only, the host owns load / save / conflict.
- Supporting pieces:
  - `CodeCard` — renders entries as formatted pseudo-code; pure, no highlighting library
  - `Marquee` — client component; CSS animation gated by theme motion and `prefers-reduced-motion`; duplicates marked `aria-hidden`
  - `CtaButton` — resolves a `LinkTarget` to an in-page anchor or an external link — shared with later sections via `packages/sections/src/shared/`
  - `AvailabilityBadge`, `SocialIconRow` — read identity props; shared with `contact-section`
- The renderer receives `identity` as a prop from the page composer; it does not fetch it.
- Patterns: Strategy + Registry on both sides — from the approved list.
## Data Model
No new collection. One `sections` document with `type: "hero"`, `data` validated by the
schema above. **Seed:** `apps/api/src/seed/data/sections/hero.json`, transcribed from
`design_reference.md`; inserted only when the document is absent.
## Constitution Check
- [x] No new datastore introduced without ADR
- [x] Open/Closed: nothing in `SectionService`, its routes, the page composer or the editor host is edited
- [x] No business payload hardcoded — reference content is seed data
- [x] No colour, radius or font literal in the renderer (`design-theme.AC8`)
- [x] Accessibility and reduced motion covered by acceptance criteria
- [ ] Seed content complete — blocked on OQ1 (clipped `stack` array and marquee list)
## Explicitly Deferred
- Entrance animations — blocked on OQ2.
- A second hero variant — separate spec.
- Typing or cursor-blink animation in the code card beyond a static cursor block — not specified.
## Sequencing
1. Contract schema `hero.ts`
2. Shared pieces in `packages/sections/src/shared/`
3. `hero/split-code-card.tsx` with `CodeCard`
4. `Marquee` client component with motion gating and faded edges
5. Hero editor
6. Visual baselines at 1440 and 390, axe check, anchor-focus E2E
