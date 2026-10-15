# blockers.md
## Stuck — all waiting on the owner (raised 2026-10-11)
- **ADR-0006** — does "AI for UI designs" mean validated theme tokens + layout variants (as
  specified), or free-form generated pages? Blocks `ai-design-studio`, `design-theme`.
- **ADR-0004, ADR-0005** — confirm or change snapshot publishing and the section registry
  model. Block `publish-pipeline`, `section-engine`. (ADR-0007 accepted 2026-10-15.)
- **Fonts** — the three font families in the reference design. Blocks `design-theme` (OQ1).
- **Exact accent colour** — sampled value is approximate. Blocks `design-theme` (OQ2).
- **Second Brain description** — the reference content still holds the placeholder
  `[ADD A ONE-LINE DESCRIPTION OF WHAT SECOND BRAIN DOES]`. Does not block building; it blocks
  the first publish (`publish-pipeline.AC4`). `work-showcase` (OQ1).
- **Clipped values** — the full `stack` array in the hero code card and the full marquee list.
  `hero-section` (OQ1).
- **Motion, hover states and mobile navigation** — not present in a flat export.
  `public-site-rendering` (OQ1, OQ2), `hero-section` (OQ2).
- **Link targets** — confirm the GitHub, LinkedIn and Second Brain URLs taken from the résumé.
  `site-identity` (OQ1).
- **BRD-008** — is résumé import wanted? Parked; nothing is specified for it.
