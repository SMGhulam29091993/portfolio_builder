# ADR-0014: AI-arranged layouts are structured data; a per-portfolio design library keeps them
**Status:** Accepted — owner, 2026-10-21 ("I want the combination first and second option both":
structured layouts the AI can design, plus more variety, presets and an explore mode — the
"AI writes real HTML/UI code" option was offered and not chosen). Amends ADR-0006; does not
supersede it.

## Context
With two hand-built variants per section (ADR-0006 → Variant catalogue), proposals kept
returning near-identical layouts, and nothing a proposal produced could be kept for later. The
owner asked for the AI to create genuinely different layouts and for them to be stored for reuse.
Letting a model write HTML or components (ADR-0006 reading (b)) would put model-written code in
front of every visitor and every member on the platform's own origin; the owner chose to keep
the constitution's "model output is data, never code" rule.

## Decision
- **A custom layout is data.** It arranges a section's existing building blocks — rendered by the
  same reviewed components the catalogue variants use — in stacks and columns, at most two levels
  deep, with an alignment and spacing chosen from short enums. Every block of the section appears
  exactly once, so no content can be dropped. The shape, the block catalogue and the validator
  live in `packages/design-tokens` beside `DesignSpec`, so the API, the CMS and the AI parser give
  one verdict. Our renderer draws it; no model text is ever markup, style or code.
- **A design's layout entry is a catalogue variant id or `custom:<layoutId>`**, naming a layout in
  the portfolio's library for that section.
- **The design library** (owned by `design`) keeps a portfolio's custom layouts and named design
  presets (theme and layout together). Applying an AI proposal that carries custom layouts saves
  them to the library first. A layout or preset is never silently broken: deleting a layout the
  draft design or a preset uses is refused.
- **A published snapshot carries copies of the custom layouts it uses**
  (`design.customLayouts`), so library edits never change a live site;
  `SNAPSHOT_SCHEMA_VERSION` becomes 2 and version-1 snapshots render as before.
- **Explore mode** asks the provider for new arrangements for every section in scope instead of
  adjustments to the current design.

## Consequences
- Far more layouts are possible (any arrangement of a section's blocks) with the same safety
  properties as ADR-0006: validated data, existing components, contrast checked, nothing executed.
- Visual variety is still bounded by the building blocks; new kinds of block or new visual
  styles are reviewed components added by hand, never generated. Adding more hand-drawn catalogue
  variants needs design input (`design_reference.md` → Unknowns) and is not part of this ADR.
- Providers must emit a fixed-depth (non-recursive) schema, because strict structured-output
  modes do not all accept recursion.
