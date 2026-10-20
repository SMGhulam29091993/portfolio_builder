# Tasks: Site Identity
## Derived From
.ai-context/plans/site-identity.plan.md
## Sequence
- [x] site-identity.T01 — `packages/contracts/src/identity`: `Identity` schema with all limits and the one-per-platform rule; request/response schemas — Acceptance: AC4, AC7
- [x] site-identity.T02 — `identities` model with the unique index; `IdentityRepository` with conditional update and create — Acceptance: AC2, AC3, AC11
- [x] site-identity.T03 — `IdentityService`: read (template at revision 0), update with asset-kind validation through `IAssetLookup` — Acceptance: AC2, AC3, AC5, AC6, AC11
- [x] site-identity.T04 — `IdentityController`, routes, container wiring, OpenAPI for API01–API02 — Acceptance: AC1, AC4, AC11
- [x] site-identity.T05 — `IdentityAssetReferenceProvider` registered with the `assets` module — Acceptance: AC8
- [x] site-identity.T06 — `IdentitySeeder` + `seed/data/identity.ts` in `seed:all` — Acceptance: AC1, AC9
- [~] site-identity.T07 — `/cms/identity` screen with asset selects — Acceptance: AC10
