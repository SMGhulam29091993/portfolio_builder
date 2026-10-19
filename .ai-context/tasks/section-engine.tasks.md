# Tasks: Section Engine
## Derived From
.ai-context/plans/section-engine.plan.md
## Sequence
- [ ] section-engine.T01 — `packages/contracts/src/sections/primitives.ts` (all shared primitives) and the engine's request/response schemas for API01–API05 — Acceptance: AC4, AC7
- [ ] section-engine.T02 — `portfolios` and `sections` models with indexes; `PortfolioRepository`, `SectionRepository` with conditional-update writes — Acceptance: AC2, AC3, AC9
- [ ] section-engine.T03 — `plainText` sanitiser in the contracts package; `ISectionDefinition`; `SectionRegistry` with duplicate and defaults-validity checks at construction — Acceptance: AC6, AC10, AC11
- [ ] section-engine.T04 — `SectionService`: read draft, update section (sanitise, assign ids, revision check), visibility, reorder, list types — Acceptance: AC1, AC2, AC3, AC4, AC5, AC7, AC8, AC9
- [ ] section-engine.T05 — `PortfolioController`, `portfolio.routes.ts`, `ResolvePortfolioMiddleware`; container wiring with an empty definition list; OpenAPI for API01–API05 — Acceptance: AC1, AC5
- [ ] section-engine.T06 — the `seed:all` orchestrator over `ISeeder` (exists since `owner-auth.T09`, `apps/api/src/seed/seeder.interface.ts`) (ordered, idempotent), `PortfolioSeeder`, `SectionSeeder` reading `seed/data/sections/*.json` — Acceptance: AC12
- [ ] section-engine.T07 — `packages/sections`: `SectionRendererRegistry`, `PortfolioPage` composer with ordering, hiding, derived numbering and unknown-type skipping — Acceptance: AC13, AC14
