# Tasks: Contact Section
## Derived From
.ai-context/plans/contact-section.plan.md
## Sequence
- [x] contact-section.T01 — Contract schema `contact.ts`, `ContactSectionDefinition`, container registration, `seed/data/sections/contact.json` — Acceptance: AC1, AC2
- [x] contact-section.T02 — `buildMailto` and `CopyEmailChip` with fallback and live-region announcement — Acceptance: AC5, AC6, AC7
- [x] contact-section.T03 — `contact/glow-card.tsx`: centred card, dot grid and glow from theme effects, social row with labels — Acceptance: AC3, AC4, AC8
- [x] contact-section.T04 — Contact editor with the read-only identity email and link to `/cms/identity`; register — Acceptance: AC9
- [x] contact-section.T05 — Visual baselines at 1440 and 390, axe check with the glow on — Acceptance: AC3 — runs in the public-site journeys (`public-site-rendering`), where the page renders at real 1440 / 390 widths; the CMS preview is a scaled frame
  - Done 2026-10-21 in `apps/web/e2e/public-site.spec.ts`: VR01/VR02 assert the page layout at 1440 and 390 and attach full-page screenshots for the owner; E2E11 runs axe at both widths with no serious or critical violation; E2E05 covers anchor focus.
