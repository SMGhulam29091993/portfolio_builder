# Tasks: Section Engine
## Derived From
.ai-context/plans/section-engine.plan.md
## Sequence
- [x] section-engine.T01 — `packages/contracts/src/sections/primitives.ts` (all shared primitives, `listItem`), slug schema and reserved list, and the engine's request/response schemas for API01–API06 — Acceptance: AC4, AC7
- [x] section-engine.T02 — `portfolios` (`userId`, `slug` unique) and `sections` models with indexes; `PortfolioRepository`, `SectionRepository` with conditional-update writes and race-safe creation; fakes and contract suites — Acceptance: AC2, AC3, AC9, AC15 (indexes)
- [~] section-engine.T03 — `ISectionDefinition`; `SectionRegistry` with duplicate and defaults-validity checks at construction; `CryptoIdGenerator` — Acceptance: AC6, AC10, AC11
- [ ] section-engine.T04 — `SectionService` (read draft with missing-document defaults, update with id assignment and revision check, visibility, reorder, list types) and `PortfolioProvisioner` (get-or-create, initial slug, slug change) — Acceptance: AC1–AC9, AC15, AC17, AC18
- [ ] section-engine.T05 — `PortfolioController`, `portfolio.routes.ts`, `ResolvePortfolioMiddleware`, `IUserDirectory` on `auth`; container wiring with an empty definition list; OpenAPI for API01–API06; route tests including tenant isolation — Acceptance: AC1, AC5, AC15, AC16
- [ ] section-engine.T06 — the `seed:all` orchestrator over `ISeeder` (ordered, idempotent), `PortfolioSeeder`, `SectionSeeder` reading `seed/data/sections/*.ts` — Acceptance: AC12
- [ ] section-engine.T07 — `packages/sections`: `SectionRendererRegistry`, `PortfolioPage` composer with ordering, hiding, derived numbering and unknown-type skipping — Acceptance: AC13, AC14
