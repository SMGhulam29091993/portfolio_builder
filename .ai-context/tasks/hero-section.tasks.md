# Tasks: Hero Section
## Derived From
.ai-context/plans/hero-section.plan.md
## Sequence
- [x] hero-section.T01 — Contract schema `hero.ts` (incl. `Identifier`, unique-key and CTA-target rules), `HeroSectionDefinition`, container registration, `seed/data/sections/hero.json` with the visible reference values — Acceptance: AC1, AC2
- [x] hero-section.T02 — Shared pieces in `packages/sections/src/shared/`: `CtaButton`, `AvailabilityBadge`, `SocialIconRow`, `EmphasisHeadingText` — Acceptance: AC4, AC6, AC7, AC8
- [x] hero-section.T03 — `hero/split-code-card.tsx` with `CodeCard`: two-column at 1440, single column at 390, `h1`, intro composition, location footer — Acceptance: AC3, AC4, AC5, AC9, AC10
- [x] hero-section.T04 — `Marquee` client component with motion gating and faded edges — Acceptance: AC11
- [x] hero-section.T05 — Hero editor: all fields, text/list value switch, list limits; register in the editor registry — Acceptance: AC12
- [x] hero-section.T06 — Visual baselines at 1440 and 390, axe check, anchor-focus E2E — Acceptance: AC3, AC7 — runs in the public-site journeys (`public-site-rendering`), where the page renders at real 1440 / 390 widths; the CMS preview is a scaled frame
  - Done 2026-10-21 in `apps/web/e2e/public-site.spec.ts`: VR01/VR02 assert the page layout at 1440 and 390 and attach full-page screenshots for the owner; E2E11 runs axe at both widths with no serious or critical violation; E2E05 covers anchor focus.
