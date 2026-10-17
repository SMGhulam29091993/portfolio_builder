# Tasks: CMS Panel Shell
## Derived From
.ai-context/plans/cms-panel-shell.plan.md
## Sequence
- [ ] cms-panel-shell.T01 — `lib/api/client.ts` (envelope, `ApiError`, cross-tab serialised refresh + one retry, `SESSION_EXPIRED` handling) and `lib/api/auth.ts` hooks — Acceptance: AC3
- [ ] cms-panel-shell.T02 — `middleware.ts` route protection, `safeNext`, `/cms/login` screen with generic error and 429 countdown, `/cms/forgot-password` screen — Acceptance: AC1, AC2, AC15
- [ ] cms-panel-shell.T03 — CMS layout: session check, navigation from `section-engine.API02` + fixed entries, publish status header, `noindex` metadata, toast region — Acceptance: AC4, AC11, AC12
- [ ] cms-panel-shell.T04 — Form kit: text, textarea with counters, switch, `ListField`, `EmphasisHeadingField`, `MetricListField`, `TagListField`, `LinkTargetField` — Acceptance: AC13
- [ ] cms-panel-shell.T05 — Editor registry and `SectionEditorHost`: load, dirty/valid Save, 400 field mapping, 409 dialog, unsaved-changes guard — Acceptance: AC4, AC5, AC6, AC7, AC8
- [ ] cms-panel-shell.T06 — Overview screen: section list, visibility switch, drag and keyboard reorder — Acceptance: AC10
- [ ] cms-panel-shell.T07 — `PreviewPane`: preview model, 1440 / 390 frames scaled to fit, 300 ms debounce, error boundary per section — Acceptance: AC9
- [ ] cms-panel-shell.T08 — Loading / empty / error states for every async view; axe checks and the keyboard-only E2E journey — Acceptance: AC14
