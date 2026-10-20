# Spec: About Section
## Spec ID
about-section
## Status
In Progress
- DoR self-check: 2026-10-20, pass. Moved `Draft → Ready` by the agent under the owner's
  standing authorisation of 2026-10-20 (`governance.md`), then `Ready → In Progress`.
- Revised 2026-10-20, before the spec was ever `Ready`: (1) ADR-0010 — the definition's
  `defaults()` is the reference template (this layout with bracketed placeholder text,
  e.g. `[Your headline]`) for every new portfolio; the reference content below is seed data for
  the development account only (`seed:all`); (2) ADR-0006 amendment — this spec builds both
  catalogue variants of `about`: `bento` (the reference layout, the fallback) and `stacked`
  (`design-theme` → Variant catalogue), with the same payload; (3) renderers receive the
  identity through the page context (`packages/sections` `SectionContext`); (4) visual
  baselines are replaced by layout assertions in Playwright (element positions at 1440 and 390)
  plus axe: pixel baselines differ between macOS and CI's Linux and would need per-platform
  snapshots nobody has reviewed.
## Linked BRD
.ai-context/BRD.md#BRD-001
## Intent
Make the "01 About" block — heading, bio card, "Currently" card, four stat cards and the
"How I work" process card — editable content of section type `about`, rendered as the
reference bento at 1440 and as a single column at 390.
## Context
- Builds on: .ai-context/architecture.md (Section type catalogue)
- Related: .ai-context/specs/section-engine.spec.md, design-theme.spec.md
- Shared facts used: .ai-context/ownership_index.md (Section engine endpoints · Shared payload
  primitives); reference content: .ai-context/design_reference.md (01 About)
## API Contract
No endpoints of its own. This spec owns the `data` payload of `section-engine.API03` for
`:type = about`.
```json
{ "meta": "SectionMeta",
  "heading": "EmphasisHeading",
  "bio": "PlainText(600)",
  "currently": { "enabled": true, "label": "PlainText(20)", "text": "PlainText(120)" },
  "stats": [ { "id": "ItemId", "value": "Metric.value", "label": "Metric.label" } ],
  "process": { "enabled": true, "eyebrow": "PlainText(24)", "title": "PlainText(80)",
               "note": "PlainText(160), optional",
               "steps": [ { "id": "ItemId", "title": "PlainText(40)", "description": "PlainText(140)" } ] } }
```
Limits: `stats` 0..4; `process.steps` 2..4 when `process.enabled`.
**Definition flags:** orderable, hideable, in nav.
## Acceptance Criteria
1. about-section.AC1 — Given a seeded database, when the about section is read, then it holds
   the reference content: eyebrow `About`, heading `Production backends,` + `with AI built in.`,
   the bio, `Currently` text, the four stats and the four process steps from the design
   reference.
2. about-section.AC2 — Given a payload with a fifth stat, a bio of 601 characters, one process
   step or five process steps while the process card is enabled, when it is saved, then the
   response is 400 naming each path.
3. about-section.AC3 — Given the page at 1440, when the section renders, then the bio card and
   the narrower "Currently" card share the first row, the stats form a 2 × 2 grid beneath, and
   the process card spans the full width with its steps in one row; given 390, then every card
   stacks in that same reading order and the steps form a column.
4. about-section.AC4 — Given the section, when it renders, then its eyebrow shows its derived
   number and `meta.eyebrow`, its heading is an `h2` with the emphasis in the display font in
   the muted colour, and the section is labelled by that heading.
5. about-section.AC5 — Given `stats` with 1, 2 or 3 items, when the grid renders at 1440, then
   no empty card placeholder appears — the last row's cards share the row's width; given no
   stats, then the grid is not rendered.
6. about-section.AC6 — Given process steps, when they render, then each shows a two-digit
   number derived from its position (`01`, `02`, …) in the accent colour, then its title and
   description; reordering the steps renumbers them.
7. about-section.AC7 — Given `currently.enabled: false` or `process.enabled: false`, when the
   section renders, then that card is absent and the remaining cards fill the row without a gap.
8. about-section.AC8 — Given `/cms/sections/about`, when the owner edits, then stats and steps
   are list fields with the limits above, character counters show remaining length, and the
   preview reflects edits.
## Edge Cases Covered
- A stat value such as `3 days` or `36→29` is plain text; no numeric parsing or animation.
- An empty optional `process.note` removes the side note and lets the title span the row.
- Long labels wrap inside their card at 390 without clipping.
- `process.enabled: false` with one stored step is valid — step limits apply only when enabled.
## Error Handling
- Payload errors return through the engine in one 400.
- A disabled card's stale content is kept in the draft, not deleted, so re-enabling restores it.
## Unit Test Cases (spec-derived)
| Test ID | Maps to AC | Scenario | Expected |
|---|---|---|---|
| about-section.UT01 | AC2 | Schema with each invalid case in AC2 | One error per case |
| about-section.UT02 | AC2 | `process.enabled: false` with one step | Valid |
| about-section.UT03 | AC1 | Definition defaults and seed file through the schema | Both valid |
| about-section.UT04 | AC5 | Render with 0, 1, 3, 4 stats | No grid; no placeholder cards; four cards |
| about-section.UT05 | AC6 | Render three steps, then reversed | Numbers follow position |
| about-section.UT06 | AC7 | Render with each card disabled | Card absent |
| about-section.UT07 | AC4 | Heading level and `aria-labelledby` | `h2`; section labelled |
## Explicitly Out of Scope
- A profile photo — none in the reference design.
- Animated counters on stats.
- More than one process card; icons chosen per stat.
## Non-Functional Constraints (from constitution.md)
- No literal content in the renderer; the reference text is seed data.
- Heading levels never skip (`h2` for the section, `h3` inside cards).
