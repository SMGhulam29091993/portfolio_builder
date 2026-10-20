# ADR-0006: AI generates a validated design specification, never markup or code
**Status:** Accepted — owner, 2026-10-20, reading (a), amended: version 1 ships more than one
layout variant per section (Decision → Variant catalogue), so generated designs vary layout as
well as theme

## Context
BRD-004 asks for AI-generated "UI designs" without saying what a design is. Two readings:
(a) the model picks theme tokens and layout variants that existing, tested components render;
(b) the model writes HTML/CSS/React that the site then serves.

## Decision
Reading (a). A provider returns a JSON `DesignSpec`: theme tokens (colours, font choices from an
allow-list, shape, effects) and one layout variant id per section. The server validates it
against a schema, rejects unknown variant ids and fonts, and computes contrast itself. Nothing a
model writes is ever rendered as markup, stored as code, or used as a URL.

### Variant catalogue (amendment, owner 2026-10-20)
Version 1 ships at least two layout variants for every section type: the reference layout
(`default`) and one or two alternates, each a tested renderer registered in the variant
registry. The variant ids, their names and what each changes are owned by the
`design-theme` spec. The AI picks among them; the user can pick among them by hand too.

## Consequences
- Generated designs cannot break layout, accessibility floors or security, and every one is
  renderable by construction.
- The public site never executes model output — no injection surface.
- **The range of designs is limited to what the variant catalogue contains.** Version 1 ships
  two or three variants per section (amendment above), so generation changes layout as well as
  theme; more variety comes from adding variants, never from model-written markup.
- If the owner wants reading (b) — free-form generated pages — this ADR is rejected and
  `ai-design-studio`, `design-theme` and parts of `public-site-rendering` need new specs,
  including sandboxing and sanitisation that are not designed here.
