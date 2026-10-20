# Tasks: Work Showcase
## Derived From
.ai-context/plans/work-showcase.plan.md
## Sequence
- [x] work-showcase.T01 — `projectRules.ts`, contract schema `work.ts`, `WorkSectionDefinition`, container registration, `seed/data/sections/work.json` (placeholder kept verbatim) — Acceptance: AC1, AC2
- [x] work-showcase.T02 — Shared `TagList`, `MetricPanel`, `ExternalLinkButton` — Acceptance: AC5, AC9
- [x] work-showcase.T03 — `work/featured-grid.tsx` with `FeaturedProjectCard` and `ProjectCard`: layouts at 1440 and 390, no-featured and incomplete-row handling, metric-less cards — Acceptance: AC3, AC4, AC6, AC7, AC8, AC9
- [x] work-showcase.T04 — Work editor: reorderable project list, featured switch with exclusivity, metric limits tied to featured state, guarded un-feature; register — Acceptance: AC10
- [x] work-showcase.T05 — Visual baselines at 1440 and 390, axe check — Acceptance: AC3, AC4 — runs in the public-site journeys (`public-site-rendering`), where the page renders at real 1440 / 390 widths; the CMS preview is a scaled frame
  - Done 2026-10-21 in `apps/web/e2e/public-site.spec.ts`: VR01/VR02 assert the page layout at 1440 and 390 and attach full-page screenshots for the owner; E2E11 runs axe at both widths with no serious or critical violation; E2E05 covers anchor focus.
