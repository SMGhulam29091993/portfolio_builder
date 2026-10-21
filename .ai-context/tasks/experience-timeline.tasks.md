# Tasks: Experience Timeline
## Derived From
.ai-context/plans/experience-timeline.plan.md
## Sequence
- [x] experience-timeline.T01 — Contract schema `experience.ts` (date-range refinement), `ExperienceSectionDefinition`, container registration, `seed/data/sections/experience.json` — Acceptance: AC1, AC2
- [x] experience-timeline.T02 — `dates.ts`: `sortEntries`, `formatRange` with the fixed month abbreviations — Acceptance: AC3, AC4
- [x] experience-timeline.T03 — `experience/timeline.tsx` with `TimelineEntry`: two-column at 1440, left-rail at 390, current marker, semantic markup — Acceptance: AC5, AC6, AC7
- [x] experience-timeline.T04 — `MonthYearField` in the form kit; experience editor with "Current role" switch and highlights list; register — Acceptance: AC8
- [x] experience-timeline.T05 — Visual baselines at 1440 and 390, axe check — Acceptance: AC5 — runs in the public-site journeys (`public-site-rendering`), where the page renders at real 1440 / 390 widths; the CMS preview is a scaled frame
  - Done 2026-10-21 in `apps/web/e2e/public-site.spec.ts`: VR01/VR02 assert the page layout at 1440 and 390 and attach full-page screenshots for the owner; E2E11 runs axe at both widths with no serious or critical violation; E2E05 covers anchor focus.
