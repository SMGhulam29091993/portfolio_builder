# ADR-0006: AI generates a validated design specification, never markup or code
**Status:** Proposed — **the largest assumption in this spec set; confirm before building**

## Context
BRD-004 asks for AI-generated "UI designs" without saying what a design is. Two readings:
(a) the model picks theme tokens and layout variants that existing, tested components render;
(b) the model writes HTML/CSS/React that the site then serves.

## Decision
Reading (a). A provider returns a JSON `DesignSpec`: theme tokens (colours, font choices from an
allow-list, shape, effects) and one layout variant id per section. The server validates it
against a schema, rejects unknown variant ids and fonts, and computes contrast itself. Nothing a
model writes is ever rendered as markup, stored as code, or used as a URL.

## Consequences
- Generated designs cannot break layout, accessibility floors or security, and every one is
  renderable by construction.
- The public site never executes model output — no injection surface.
- **The range of designs is limited to what the variant catalogue contains.** Version 1 ships
  one variant per section (the reference design), so the first release of AI generation changes
  theme only; layout variety grows as variants are added.
- If the owner wants reading (b) — free-form generated pages — this ADR is rejected and
  `ai-design-studio`, `design-theme` and parts of `public-site-rendering` need new specs,
  including sandboxing and sanitisation that are not designed here.
