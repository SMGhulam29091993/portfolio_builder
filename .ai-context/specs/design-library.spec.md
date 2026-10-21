# Spec: Design Library — AI-arranged layouts, a layout library and design presets
## Spec ID
design-library
## Status
In Progress
- DoR self-check: 2026-10-21, pass. Written from the owner's decision of 2026-10-21 (ADR-0014,
  Accepted) and moved `Draft → Ready` by the agent under the owner's standing authorisation of
  2026-10-20 (`governance.md`).
## Linked BRD
.ai-context/BRD.md#BRD-004
## Intent
Let the AI design genuinely different section layouts, and let the user keep what they like.
A **custom layout** arranges one section's existing building blocks in stacks and columns; it
is validated data drawn by the same reviewed components the catalogue variants use, so nothing
a model writes is ever markup or code (ADR-0014, amending ADR-0006). Custom layouts live in a
per-portfolio **layout library**; a **design preset** keeps a whole look (theme and layout) under
a name. The AI Studio gains **Explore new layouts**, which asks for new arrangements instead of
adjustments, and **Save as preset**.
## Context
- Builds on: ADR-0014, ADR-0006; `design-theme` (DesignSpec, `design` module), `ai-design-studio`
  (proposals), `publish-pipeline` (snapshots), `public-site-rendering` (renderer)
- Shared facts used: `ownership_index.md` (DesignSpec · Optimistic concurrency · Session
  contract · Snapshot shape)

## Custom layout (canonical; `packages/design-tokens`)
```typescript
type Gap = 'sm' | 'md' | 'lg';
type Columns = '1-1' | '2-1' | '1-2' | '1-1-1';
interface LayoutBlock { kind: 'block'; block: BlockId; style: BlockStyle | null }
interface InnerContainer { kind: 'stack' | 'columns'; gap: Gap; columns: Columns | null; children: LayoutBlock[] }   // 1–4
interface CustomLayout {
  section: SectionType;
  align: 'start' | 'center';              // the heading and the hero introduction
  body: { kind: 'stack' | 'columns'; gap: Gap; columns: Columns | null; children: (InnerContainer | LayoutBlock)[] }   // 1–4
}
```
- `columns` is required for `kind: 'columns'` (and is the number of children: `1-1`, `2-1`,
  `1-2` take 2, `1-1-1` takes 3) and must be `null` for `stack`. Columns stack on phones.
- **Every block of the section appears exactly once**, so no content is lost. A block whose data
  is switched off (the Currently card, the code card, …) draws nothing, as in the catalogue.
- Fixed depth (body → inner container → block): no recursion, for strict structured output.

### Block catalogue — each block is an existing component
| Section | Blocks (style options) |
|---|---|
| hero | `intro` (—), `code-card` (—). The marquee and the backdrop stay where the hero draws them |
| about | `bio` (—), `currently` (—), `stats` (`two-columns` \| `four-columns`), `process` (`row` \| `list`) |
| work | `featured` (—), `projects` (`grid` \| `list`) — the featured project is drawn by `featured` only |
| experience | `jobs` (`timeline` \| `cards`) |
| stack | `skills` (`cards` \| `rows`), `credentials` (—) |
| contact | `message` (—), `actions` (—) |
A block with style options requires one; a block without takes `null`.

## Design reference to a custom layout
A design's `layout[section]` is a catalogue variant id or `custom:<layoutId>`. The draft design
may name only a layout in this portfolio's library **for that section**; anything else is a 400
`VALIDATION_FAILED` at `layout.<section>`. The renderer falls back to the reference variant for a
`custom:` id it cannot resolve.

## Data
- `design_layouts` (writer: `design`): `portfolioId`, `section`, `name` (PlainText 60),
  `layout` (CustomLayout), `source` (`ai` | `preset`), `createdAt`. At most 50 per portfolio.
- `design_presets` (writer: `design`): `portfolioId`, `name` (PlainText 60), `design`
  (DesignSpec — its `custom:` entries refer to library layouts), `createdAt`. At most 20.

## API Contract (`design` module, under `/api/v1/cms/design`)
### design-library.API01 — GET /layouts
`data: { layouts: [{ id, section, name, layout, source, createdAt }] }`, newest first.
### design-library.API02 — DELETE /layouts/:id
`data: { deleted: true }`. 404 unknown; 409 `LAYOUT_IN_USE` with `usedBy: ('draft' | 'preset')[]`.
### design-library.API03 — GET /presets
`data: { presets: [{ id, name, design, createdAt }] }`, newest first.
### design-library.API04 — POST /presets
Body `{ name }` — saves the current draft design. `201 data: { preset }`. 409 `LIBRARY_FULL`.
### design-library.API05 — POST /presets/:id/apply
Body `{ expectedRevision }` — replaces the draft design (as `design-theme.API02`, validated).
`data: { design }`. 404; 409 `REVISION_CONFLICT`; 400 when a layout it names is gone.
### design-library.API06 — DELETE /presets/:id
`data: { deleted: true }`. 404.
### `ai-design-studio` additions
- API01 body gains `explore: boolean` (default `false`).
- A proposal's `design` may carry `customLayouts: { [section]: CustomLayout }`.
- API04 (apply) saves each custom layout to the library (`source: ai`, named from the prompt)
  before writing the design; 409 `LIBRARY_FULL` when it would exceed 50.
- **ai-design-studio.API07 — POST /cms/ai/design-proposals/:id/preset** — body `{ name }`; a
  `ready` or `applied` proposal is saved as a preset (its custom layouts to the library). `201`.

## Snapshot
`SNAPSHOT_SCHEMA_VERSION` 2: `design.customLayouts` holds a copy of every custom layout the
published design names. Version-1 snapshots have none and render as before.

## Acceptance Criteria
1. design-library.AC1 — Given a candidate custom layout, when validated, then it is accepted
   only if its shape, depth, child counts, `columns`/`kind` pairing and block styles are valid and
   every block of its section appears exactly once; otherwise each problem is reported with a path.
2. design-library.AC2 — Given a design naming `custom:<id>`, when saved, then it is accepted only
   if the layout exists in this portfolio's library for that section.
3. design-library.AC3 — Given a custom layout, when the page renders (site and CMS preview), then
   the section is drawn from its blocks in the given arrangement, with columns stacking on phones.
4. design-library.AC4 — Given a published design using a custom layout, when the layout is later
   deleted, then the live site still renders it (the snapshot holds a copy).
5. design-library.AC5 — Given a layout used by the draft design or a preset, when deleted, then
   409 `LAYOUT_IN_USE` and nothing changes.
6. design-library.AC6 — Given presets, when one is saved, listed, applied with the current
   revision, or deleted, then the draft design and the list change accordingly; a stale revision
   is 409 `REVISION_CONFLICT`.
7. design-library.AC7 — Given `explore: true`, when a proposal is generated, then the provider is
   asked for a new custom layout for every section in scope and not to reuse the current layout.
8. design-library.AC8 — Given a proposal with custom layouts, when applied, then each is saved to
   the library and the design names them; when a proposal is saved as a preset, its layouts are
   saved too.
9. design-library.AC9 — Given the CMS, then the Design screen lists the library layouts in each
   section's layout choice, lists presets (apply, delete, save current), and lets a layout be
   deleted; the AI Studio offers Explore new layouts and Save as preset, and previews a proposal's
   custom layouts.
## Edge Cases Covered
- A model returns a custom layout for a section outside the scope: ignored (scope merge).
- A model returns a custom layout that fails validation: the proposal's normal repair attempt,
  then `INVALID_OUTPUT`.
- Two proposals applying layouts concurrently: each saves its own layouts; the design's revision
  check decides which design wins.
- Library full: applying or saving a preset answers 409 `LIBRARY_FULL` before writing anything.
## Explicitly Out of Scope
- Model-written HTML, CSS or components (ADR-0014 keeps ADR-0006's rule).
- New block kinds or visual styles, and more hand-drawn catalogue variants (need design input).
- Renaming layouts or presets; sharing them between users.
## Non-Functional Constraints
- One validator for custom layouts in `packages/design-tokens`, used by the API, the CMS and the
  AI parser; no model text is rendered except as plain text inside existing components.
