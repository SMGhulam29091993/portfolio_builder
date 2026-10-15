# Tasks: Design Theme
## Derived From
.ai-context/plans/design-theme.plan.md
## Sequence
- [ ] design-theme.T01 — `packages/design-tokens`: `ThemeTokens` / `DesignSpec` schemas, `VARIANT_CATALOGUE`, `FONT_ALLOW_LIST` (after OQ1), `contrastRatio`, `checkContrast`, `toCssVariables`, `DEFAULT_DESIGN` (after OQ1 + OQ2) — Acceptance: AC4, AC7
- [ ] design-theme.T02 — `designs` model with the unique index; `DesignRepository` with conditional update — Acceptance: AC2, AC5
- [ ] design-theme.T03 — `DesignValidator` and `DesignService` (read, update, reset; reader / writer / validator interfaces) — Acceptance: AC2, AC3, AC4, AC5, AC6, AC11
- [ ] design-theme.T04 — `DesignController`, routes, container wiring, OpenAPI for API01–API03 — Acceptance: AC1, AC3
- [ ] design-theme.T05 — `DesignSeeder` (idempotent) — Acceptance: AC1
- [ ] design-theme.T06 — `ThemeStyle` component, Tailwind-to-CSS-variable mapping, motion gating, lint rule banning colour / font literals in `packages/sections` — Acceptance: AC7, AC8, AC9
- [ ] design-theme.T07 — `/cms/design` screen: token editors, live contrast badges, catalogue-bound selects, reset — Acceptance: AC10
