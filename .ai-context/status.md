# Project Status Board
_Last updated: 2026-10-15_

Lifecycle: `Draft → Ready → In Progress → Implemented → Released` (`governance.md`). Only the
owner moves a spec to `Ready`.

## Active Specs
| # | Spec ID | Title | Status | BRD | Blocked on before `Ready` |
|---|---|---|---|---|---|
| 1 | `monorepo-foundation` | Turborepo, API bootstrap, shared packages | In Progress | BRD-007 | — |
| 2 | `owner-auth` | Owner sign-in and sessions | Draft | BRD-002 | — |
| 3 | `section-engine` | Section registry and draft content engine | Draft | BRD-001 | ADR-0005 |
| 4 | `cms-panel-shell` | CMS layout, editor host, live preview | Draft | BRD-001 | — |
| 5 | `site-identity` | Name, contact, socials, résumé link, footer, SEO | Draft | BRD-001 | OQ1 link targets, OQ2 SEO text |
| 6 | `media-assets` | Résumé and image uploads | Draft | BRD-006 | — |
| 7 | `design-theme` | Theme tokens and layout variants | Draft | BRD-003 | OQ1 fonts, OQ2 accent; ADR-0006 |
| 8 | `hero-section` | Hero, code card, tech marquee | Draft | BRD-001 | OQ1 clipped values, OQ2 marquee motion |
| 9 | `about-section` | Bio, currently, stats, process | Draft | BRD-001 | — |
| 10 | `work-showcase` | Featured project and project cards | Draft | BRD-001 | — (OQ1 Second Brain copy blocks the first publish, not `Ready`) |
| 11 | `experience-timeline` | Role timeline | Draft | BRD-001 | — |
| 12 | `stack-credentials` | Skills, education, certifications | Draft | BRD-001 | — |
| 13 | `contact-section` | Contact card | Draft | BRD-001 | — |
| 14 | `publish-pipeline` | Validate, snapshot, publish, rollback | Draft | BRD-005 | ADR-0004 |
| 15 | `public-site-rendering` | Public site shell, SEO, fidelity | Draft | BRD-003 | OQ1 mobile nav, OQ2 motion |
| 16 | `ai-design-studio` | AI design proposals | Draft | BRD-004 | ADR-0006, ADR-0003 mechanics |

`OQ<n>` refers to the numbered Open Questions section of that spec.

## Daily Execution Log
### 2026-10-15
- ADR-0007 accepted by the owner as proposed; `monorepo-foundation` moved to `Ready`, then
  `In Progress` with `monorepo-foundation.T01` started.
- `monorepo-foundation.T01` completed: pnpm + Turborepo workspace, `packages/tsconfig`,
  `packages/eslint-config`; versions pinned in ADR-0007 (TypeScript held at 6.0.3).
- `monorepo-foundation.T02` completed: buildable skeletons for `contracts`, `design-tokens`,
  `sections`.
### 2026-10-11
- All 16 specs, plans, task lists and test-case files authored from `Ghulam Portfolio.html`.
- ADR-0001 and ADR-0002 accepted by the owner; ADR-0003 accepted for the provider list;
  ADR-0004 to ADR-0007 proposed and awaiting the owner.
- No implementation started.
