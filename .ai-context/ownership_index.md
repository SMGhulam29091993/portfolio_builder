# Ownership Index

Any fact (a collection, an endpoint contract, a payload type, a business rule) referenced by
more than one file appears here with exactly one canonical owner. Every other file links to the
owner — it never restates the full definition. Paths are relative to the repository root.

## Layer rules, SOLID enforcement, approved LLD patterns
**Canonical definition:** `.agent/rules/constitution.md` → Architectural Constraints
**Referenced by:** `agent-role.md`, `int-standards.express.md`, `code-review.md`, every plan's Constitution Check
**Last updated:** 2026-10-11

## Response envelope and canonical error codes
**Canonical definition:** `.agent/rules/int-standards.express.md` → Standardised response shape
**Referenced by:** every spec's API Contract (exception tables name a code, not a shape)
**Last updated:** 2026-10-11

## Module router convention (`ApiRouter`, mounted route table)
**Canonical definition:** `.agent/rules/int-standards.express.md` → Adding a feature, step 5
**Referenced by:** `.ai-context/architecture.md` → Request lifecycle, `apps/api/src/app.ts`
**Last updated:** 2026-10-15

## Optimistic concurrency (`revision` / `expectedRevision`)
**Canonical definition:** `.agent/rules/int-standards.express.md` → Optimistic concurrency
**Referenced by:** `section-engine`, `site-identity`, `design-theme`, `ai-design-studio`, `cms-panel-shell` specs
**Last updated:** 2026-10-11

## Tooling choices and pinned versions
**Canonical definition:** `.ai-context/decisions/ADR-0007-tooling-baseline.md` → Decision · Pinned versions
**Referenced by:** `constitution.md` (Testing Discipline), `pnpm-workspace.yaml`, every workspace `package.json`
**Last updated:** 2026-10-15

## Module list, dependency map, collection writers
**Canonical definition:** `.ai-context/architecture.md` → API modules · Module dependency map · Data ownership
**Referenced by:** `constitution.md`, every plan's Architecture Approach and Data Model,
`apps/api/src/architecture/module-dependency-map.ts` (the allowed edges as data, enforced by the architecture test),
`int-standards.express.md` (Adding a feature, step 6), `generate-plan.md` (step 8), `code-review.md` (SOLID and module boundaries)
**Last updated:** 2026-10-17

## Boundary lint rules and their exemptions
**Canonical definition:** `packages/eslint-config/api.js` (rules in `packages/eslint-config/plugin/`); summarised in `.ai-context/architecture.md` → Boundary enforcement
**Referenced by:** `apps/api/eslint.config.js`, `apps/api/src/architecture/boundary-lint.spec.ts`, `.agent/workflows/code-review.md`
**Last updated:** 2026-10-17

## Section type catalogue (types, orderable / hideable flags, owning spec)
**Canonical definition:** `.ai-context/architecture.md` → Section type catalogue
**Referenced by:** `section-engine`, `design-theme`, `public-site-rendering`, `cms-panel-shell` specs
**Last updated:** 2026-10-11

## Environment variables
**Canonical definition:** `.ai-context/architecture.md` → Environment
**Referenced by:** `monorepo-foundation`, `owner-auth`, `ai-design-studio`, `publish-pipeline`, `public-site-rendering` plans; `apps/api/src/config/env.ts`, `apps/web/src/lib/env.ts`, `turbo.json` (`build.env`, `dev.passThroughEnv`)
**Last updated:** 2026-10-17

## Reference content, visual tokens, design unknowns
**Canonical definition:** `.ai-context/design_reference.md`
**Referenced by:** `BRD.md`, the six section specs, `site-identity`, `design-theme`, `public-site-rendering` specs
**Last updated:** 2026-10-11

## Section engine endpoints (`section-engine.API01`–`API05`)
**Canonical definition:** `.ai-context/specs/section-engine.spec.md` → API Contract
**Referenced by:** the six section specs (each owns only its `data` payload), `cms-panel-shell` spec
**Last updated:** 2026-10-11

## Shared payload primitives (`EmphasisHeading`, `SectionMeta`, `Metric`, `LinkTarget`, `plainText` limits)
**Canonical definition:** `.ai-context/specs/section-engine.spec.md` → Shared payload primitives
**Referenced by:** the six section specs, `site-identity` spec
**Last updated:** 2026-10-11

## Identity payload (name, email, socials, résumé reference, availability, footer, SEO)
**Canonical definition:** `.ai-context/specs/site-identity.spec.md` → `site-identity.API02`
**Referenced by:** `hero-section`, `contact-section`, `public-site-rendering`, `publish-pipeline` specs
**Last updated:** 2026-10-11

## Asset reference (`assetId`, kinds, type and size limits)
**Canonical definition:** `.ai-context/specs/media-assets.spec.md` → Asset reference
**Referenced by:** `site-identity`, `publish-pipeline`, `public-site-rendering` specs
**Last updated:** 2026-10-11

## Public asset URL (`/api/v1/public/assets/:id/:filename`)
**Canonical definition:** `.ai-context/specs/public-site-rendering.spec.md` → `public-site-rendering.API02`
**Referenced by:** `media-assets` spec (states that it does not serve anonymous requests)
**Last updated:** 2026-10-11

## `DesignSpec` — `ThemeTokens`, layout map, variant catalogue, font allow-list, contrast rule
**Canonical definition:** `.ai-context/specs/design-theme.spec.md` → Design payload
**Referenced by:** `ai-design-studio`, `publish-pipeline`, `public-site-rendering`, `cms-panel-shell` specs
**Last updated:** 2026-10-11

## Session contract (cookies, `requireOwner`, Origin allow-list)
**Canonical definition:** `.ai-context/specs/owner-auth.spec.md` → Session contract
**Referenced by:** every spec with a `/api/v1/cms/**` endpoint, `cms-panel-shell` spec
**Last updated:** 2026-10-11

## `PublishedContent` snapshot shape, `IDraftContributor`, publish rules
**Canonical definition:** `.ai-context/specs/publish-pipeline.spec.md` → Published content · Publish rules
**Referenced by:** `public-site-rendering`, `section-engine`, `site-identity`, `design-theme`, the six section specs
**Last updated:** 2026-10-11

## AI provider port and environment rules
**Canonical definition:** `.ai-context/specs/ai-design-studio.spec.md` → Provider contract (the *why* is `.ai-context/decisions/ADR-0003-ai-provider-port.md`)
**Referenced by:** `constitution.md` (dev-bypass guard), `architecture.md` (AI design flow)
**Last updated:** 2026-10-11
