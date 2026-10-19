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

## Raised 2026-10-17
- **Module dependency map allows two cycles** — `architecture.md` → Module dependency map lists
  `publishing → portfolio` and `publishing → design` as well as `portfolio → publishing` and
  `design → publishing` (`IDraftContributor`). The constitution requires a DAG, and the
  architecture test now fails on any cycle in real code. Decide which side owns each interface
  (the section's footnote already says `publishing` owns `IPublishedPointerWriter`). Does not
  block `monorepo-foundation`; blocks `publish-pipeline.T02`. See `memory/review-findings.md`,
  2026-10-17.
- **Build output and symlinks tracked in git** — `.turbo/cache/`, `packages/*/dist/` and
  `packages/*/node_modules/` symlinks were committed in the first commit and are still tracked,
  although `.gitignore` excludes them. Any install that changes a peer set rewrites the tracked
  symlinks (it happened in `monorepo-foundation.T08`). Untracking them (`git rm -r --cached`,
  files stay on disk) needs the owner's go-ahead. Blocks nothing; noise in every diff until done.

## Raised 2026-10-18 (multi-tenancy — ADR-0010, ADR-0011)
- **What the owner role may do** that a member may not (an admin area? free credits?). Blocks
  the `account-registration` spec.
- **Owner claim through Google** — allowed, or only through the registration form? Blocks the
  `google-sign-in` spec.
- **Payment provider and what credits buy** — the provider is an external service and needs an
  ADR; price and what credits pay for (a domain only, or also AI generations) are unset. Blocks
  `credits-billing`.
- **A free portfolio's address** — a sub-domain of the platform domain or a path under it, and
  the platform domain itself. Blocks `custom-domains` and revises `public-site-rendering`.
- **The reference design as a template** — does every new user start from the reference
  portfolio's design (and none of its content)? Revises `section-engine` and `design-theme`.
