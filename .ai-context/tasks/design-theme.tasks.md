# Tasks: Design Theme
## Derived From
.ai-context/plans/design-theme.plan.md
## Sequence
- [x] design-theme.T01 — `packages/design-tokens`: `ThemeTokens` / `DesignSpec` schemas, `VARIANT_CATALOGUE` (two per section), `FONT_ALLOW_LIST`, `contrastRatio`, `checkContrast`, `validateDesign`, `toCssVariables`, `DEFAULT_DESIGN` — Acceptance: AC3, AC4, AC7
- [x] design-theme.T02 — `designs` model with the unique index; `DesignRepository` with conditional update and create — Acceptance: AC2, AC5
- [x] design-theme.T03 — `DesignValidator` and `DesignService` (read with the revision-0 default, update, reset; reader / writer / validator interfaces) — Acceptance: AC1–AC6, AC11
- [x] design-theme.T04 — `DesignController`, routes, container wiring, OpenAPI for API01–API03 — Acceptance: AC1, AC3
- [x] design-theme.T05 — dropped 2026-10-20: no seeder; the default is served at revision 0 (spec Status)
- [x] design-theme.T06 — `ThemeStyle` (CSS variables + `next/font` loaders), Tailwind mapping, motion gating, the variant-aware renderer registry, lint rule banning colour / font literals in `packages/sections` — Acceptance: AC7, AC8, AC9
- [~] design-theme.T07 — `/cms/design` screen: token editors, live contrast badges, catalogue-bound selects, reset, live preview — Acceptance: AC10
