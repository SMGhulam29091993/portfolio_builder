# Plan: Contact Section
## Derived From
.ai-context/specs/contact-section.spec.md
## Architecture Approach
A section type is four registrations and no engine edits (`architecture.md` → Section type
catalogue; `section-engine.AC10`):
1. **Contract** — `packages/contracts/src/sections/contact.ts` exports the `ContactSectionData`
   schema and type.
2. **API** — `apps/api/src/modules/portfolio/sections/contact.definition.ts`:
   `ContactSectionDefinition implements ISectionDefinition`, added to the container's definition
   list (one line).
3. **Renderer** — `packages/sections/src/contact/glow-card.tsx`, registered under variant id
   `glow-card`; pure props-in, markup-out.
4. **Editor** — `apps/web/src/app/(cms)/cms/sections/_editors/contact.tsx`, registered in the
   editor registry; declares fields only, the host owns load / save / conflict.
- Supporting pieces:
  - `buildMailto` — pure function; encodes the optional subject
  - `CopyEmailChip` — client component; clipboard with manual-select fallback and a polite live region
  - `SocialIconRow` — reused from `hero-section` shared pieces, with visible labels enabled
- The email address and socials arrive as `identity` props; the section payload never contains an address.
- Patterns: Strategy + Registry on both sides — from the approved list.
## Data Model
No new collection. One `sections` document with `type: "contact"`, `data` validated by the
schema above. **Seed:** `apps/api/src/seed/data/sections/contact.json`, transcribed from
`design_reference.md`; inserted only when the document is absent.
## Constitution Check
- [x] No new datastore introduced without ADR
- [x] Open/Closed: nothing in `SectionService`, its routes, the page composer or the editor host is edited
- [x] No business payload hardcoded — reference content is seed data
- [x] No colour, radius or font literal in the renderer (`design-theme.AC8`)
- [x] Accessibility and reduced motion covered by acceptance criteria
## Explicitly Deferred
- Contact form and message handling — not in the reference design; would be a new BRD entry.
- Email obfuscation.
- Scheduling embed.
## Sequencing
1. Contract schema `contact.ts`, `ContactSectionDefinition`, container registration, `seed/data/sections/contact.json`
2. `buildMailto` and `CopyEmailChip` with fallback and live-region announcement
3. `contact/glow-card.tsx`
4. Contact editor with the read-only identity email and link to `/cms/identity`; register
5. Visual baselines at 1440 and 390, axe check with the glow on
