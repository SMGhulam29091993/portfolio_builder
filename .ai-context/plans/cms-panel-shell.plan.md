# Plan: CMS Panel Shell
## Derived From
.ai-context/specs/cms-panel-shell.spec.md
## Architecture Approach
All in `apps/web/src`, following `int-standards.nextjs.md`. `monorepo-foundation.T08` already
provides the same-origin `/api/v1` proxy, `lib/env.ts` and a placeholder `(cms)/cms/layout.tsx`
(noindex metadata) and `page.tsx`; this plan extends those files rather than creating parallel
ones.
- **`lib/api/client.ts`** — typed fetch wrapper: same-origin `/api/v1`, envelope unwrapping,
  `ApiError` carrying `code` + details, single-flight refresh-and-retry on 401.
- **`lib/api/<area>.ts`** — TanStack Query hooks per area (`auth`, `portfolio`); types from
  `packages/contracts`.
- **`middleware.ts`** — redirects `/cms/**` without a `pb_access` cookie to `/cms/login`. Cookie
  presence only; the API remains the authority.
- **`(cms)/cms/layout.tsx`** — session check via `owner-auth.API04`, navigation, publish status
  header, toast region, unsaved-changes registry (Zustand).
- **Editor registry** — `sections/_editors/registry.ts` maps `SectionType` → editor component
  (**Strategy + Registry**, mirroring the API). `SectionEditorHost` owns load, form provider
  (react-hook-form + zod resolver with the section's contract schema), save, 400 mapping, 409
  dialog. Editors only declare fields.
- **Shared form kit** — `TextField`, `TextAreaField` with character counters from schema limits,
  `SwitchField`, `ListField` (add / remove / reorder), `EmphasisHeadingField`, `MetricListField`,
  `TagListField`, `LinkTargetField`.
- **Preview** — `PreviewPane` (client) composes `PortfolioPage` from `packages/sections` with the
  preview model (saved draft + watched form values), inside a fixed-width frame scaled with CSS
  transform; viewport state in the Zustand UI store.
## Data Model
None. No browser storage except what the framework itself uses.
## Constitution Check
- [x] No new datastore introduced without ADR
- [x] No business payload in components — every string from the API or the form
- [x] One renderer per section, shared with the public site
- [x] Client validation uses the same contract schema as the API
- [x] Accessibility is an acceptance criterion (AC14), not a follow-up
## Explicitly Deferred
- Autosave and offline drafts — explicit save keeps conflict handling simple.
- Preview of unsaved edits across several sections at once — one section's unsaved state at a time.
- A responsive CMS below 768 px — usable, not optimised.
## Sequencing
1. API client and auth hooks
2. Route protection and login screen
3. CMS layout, navigation, publish header
4. Form kit
5. Editor registry and `SectionEditorHost`
6. Overview: visibility and reorder
7. Preview pane
8. Accessibility pass and E2E
