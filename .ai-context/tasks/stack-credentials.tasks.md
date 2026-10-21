# Tasks: Stack and Credentials
## Derived From
.ai-context/plans/stack-credentials.plan.md
## Sequence
- [x] stack-credentials.T01 — Contract schema `stack.ts` (unique items, year-range refinement), `StackSectionDefinition`, container registration, `seed/data/sections/stack.json` — Acceptance: AC1, AC2
- [x] stack-credentials.T02 — `stack/chip-groups.tsx` with `ChipGroupCard`: three-column grid at 1440, stacked at 390 — Acceptance: AC3, AC8
- [x] stack-credentials.T03 — `EducationCard`, `CertificationCard`, `formatYears`; two-thirds / one-third row and the disabled / empty handling — Acceptance: AC4, AC5, AC6, AC7
- [x] stack-credentials.T04 — Stack editor: reorderable groups with tag inputs, education and certification list fields with switches; register — Acceptance: AC9
- [x] stack-credentials.T05 — Visual baselines at 1440 and 390, axe check — Acceptance: AC3, AC4 — runs in the public-site journeys (`public-site-rendering`), where the page renders at real 1440 / 390 widths; the CMS preview is a scaled frame
  - Done 2026-10-21 in `apps/web/e2e/public-site.spec.ts`: VR01/VR02 assert the page layout at 1440 and 390 and attach full-page screenshots for the owner; E2E11 runs axe at both widths with no serious or critical violation; E2E05 covers anchor focus.
