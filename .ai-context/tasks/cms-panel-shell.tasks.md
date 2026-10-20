# Tasks: CMS Panel Shell
## Derived From
.ai-context/plans/cms-panel-shell.plan.md
## Sequence
- [x] cms-panel-shell.T01 — Client dependencies (TanStack Query, react-hook-form, resolvers, Zustand; pinned in ADR-0007); `lib/api/client.ts` (envelope, `ApiError`, cross-tab serialised refresh + one retry, `SESSION_EXPIRED` handling) and `lib/api/auth.ts`, `lib/api/portfolio.ts` hooks; query provider — Acceptance: AC3
- [x] cms-panel-shell.T02 — `safeNext` (the `proxy.ts` check was dropped: see the spec Status deviation), `/cms/login` (generic error, 429 countdown, `EMAIL_NOT_VERIFIED`, Google button and notices), `/cms/forgot-password`, `/cms/register`, `/cms/verify` — Acceptance: AC1, AC2, AC15–AC19
- [~] cms-panel-shell.T03 — CMS panel layout: session check, navigation from `section-engine.API02` + fixed entries, header with the publish-status slot, sign-out, `noindex` metadata, toast region — Acceptance: AC4, AC12 (AC11's data with `publish-pipeline`)
- [ ] cms-panel-shell.T04 — Form kit: text, textarea with counters, switch, `ListField`, `EmphasisHeadingField`, `MetricListField`, `TagListField`, `LinkTargetField` — Acceptance: AC13
- [ ] cms-panel-shell.T05 — Editor registry and `SectionEditorHost`: load, dirty/valid Save, 400 field mapping, 409 dialog, unsaved-changes guard — Acceptance: AC4, AC5, AC6, AC7, AC8
- [ ] cms-panel-shell.T06 — Overview screen: section list, visibility switch, drag and keyboard reorder, portfolio address and slug change — Acceptance: AC10, AC20
- [ ] cms-panel-shell.T07 — `PreviewPane`: preview model, 1440 / 390 frames scaled to fit, 300 ms debounce, error boundary per section — Acceptance: AC9
- [ ] cms-panel-shell.T08 — E2E harness: a generic `SMTP_URL` mail strategy (ADR-0009 amendment) so the E2E API's codes land in a local `smtp-server` the specs read; the seeded development account; Playwright Chromium in CI; axe checks and the keyboard-only sign-in journey; E2E01–E2E03, E2E11–E2E12, E2E14–E2E15 and the registration journey — Acceptance: AC1–AC3, AC12, AC14–AC17
