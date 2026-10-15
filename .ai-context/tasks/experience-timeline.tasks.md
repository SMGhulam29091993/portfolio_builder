# Tasks: Experience Timeline
## Derived From
.ai-context/plans/experience-timeline.plan.md
## Sequence
- [ ] experience-timeline.T01 — Contract schema `experience.ts` (date-range refinement), `ExperienceSectionDefinition`, container registration, `seed/data/sections/experience.json` — Acceptance: AC1, AC2
- [ ] experience-timeline.T02 — `dates.ts`: `sortEntries`, `formatRange` with the fixed month abbreviations — Acceptance: AC3, AC4
- [ ] experience-timeline.T03 — `experience/timeline.tsx` with `TimelineEntry`: two-column at 1440, left-rail at 390, current marker, semantic markup — Acceptance: AC5, AC6, AC7
- [ ] experience-timeline.T04 — `MonthYearField` in the form kit; experience editor with "Current role" switch and highlights list; register — Acceptance: AC8
- [ ] experience-timeline.T05 — Visual baselines at 1440 and 390, axe check — Acceptance: AC5
