# Portfolio Builder — specification set

A hybrid SDD + AIPOS context system for a Turborepo project: a CMS panel that edits, designs
and publishes the portfolio in `docs/design-reference/`.

**Stack:** Next.js · Node.js + Express · TypeScript · MongoDB · Gemini / OpenRouter for AI design
generation, Ollama for local development.
**State:** specification only. No application code exists yet; every spec is `Draft`.

## Where to start
| You want to | Read |
|---|---|
| Orient a new session | `.ai-context/project_context.md` |
| See the rules an agent must follow | `.agent/rules/agent-role.md`, then `constitution.md` |
| See what the attached HTML contains | `.ai-context/design_reference.md` |
| See where each feature stands | `.ai-context/status.md` |
| See what is waiting on you | `.ai-context/state/blockers.md` |
| Understand the system design | `.ai-context/architecture.md` |

## What is here
```
.agent/rules/        agent-role · constitution · int-standards.express · int-standards.nextjs
                     state-tracking · governance · .agentignore
.agent/workflows/    generate-plan · implement-task · generate-tests · code-review · spec-readiness-check
.ai-context/         project_context · architecture · BRD · design_reference · ownership_index · status
  specs/ plans/ tasks/ test_cases/   one file each per feature slug (16 slugs) + _integration.md
  decisions/         ADR-0001 … ADR-0007
  state/ memory/     working state; lessons (empty until real events)
AGENTS.md CLAUDE.md GEMINI.md .cursor/ .windsurf/ .github/   thin pointers to the rules
docs/design-reference/   the two boards extracted from the HTML export
```

## Feature slugs, in build order
| # | Slug | What it delivers |
|---|---|---|
| 1 | `monorepo-foundation` | Turborepo, API bootstrap, boundary lint, OpenAPI, CI |
| 2 | `owner-auth` | Owner sign-in, rotating sessions, the CMS guard |
| 3 | `section-engine` | Section registry, generic section API, page composer |
| 4 | `cms-panel-shell` | CMS frame, editor host, live preview at 1440 / 390 |
| 5 | `site-identity` | Name, email, socials, résumé link, footer, SEO |
| 6 | `media-assets` | Résumé / image upload behind a storage interface |
| 7 | `design-theme` | Theme tokens, layout variants, contrast enforcement |
| 8–13 | `hero-section` · `about-section` · `work-showcase` · `experience-timeline` · `stack-credentials` · `contact-section` | One per block of the reference page |
| 14 | `publish-pipeline` | Validate → snapshot → publish → rollback |
| 15 | `public-site-rendering` | Public API, site shell, SEO, visual fidelity |
| 16 | `ai-design-studio` | AI design proposals through a provider port |

## How this differs from the hybrid setup guide
| Guide | Here | Why |
|---|---|---|
| Gate 1 / Gate 2 reviewers, reviewer tripwire, review dashboard | Removed. DoR / DoD kept as self-checks; `code-review.md` is a self-review; `spec-readiness-check.md` replaces the dashboard | Owner's decision — ADR-0001 |
| `Reviewed by:` lines; `⚠️ SUPERSEDED … needs re-review` | `DoR self-check:` / `DoD self-check:` lines; `⚠️ REVISED` | No reviewer exists to name |
| One `int-standards.<stack>.md` | `int-standards.express.md` + `int-standards.nextjs.md`, each scoped to its app | Turborepo with two platforms — ADR-0002 |
| Entry files named `gate-review.*` carrying the reviewer tripwire | `project-entry.*` carrying a pointer to the rules; still byte-identical across tools | Nothing gate-related left to trip |
| — | `design_reference.md` | The spec source is a design export; its content needs one owner |
| — | `implement-task.md`, test ID prefixes `IT` / `CT` / `E2E` / `VR` | With no second reviewer, the task loop and test layers are spelled out |
| ADR template without a status | `Status:` line (`Accepted` / `Proposed`) | Four ADRs are proposals awaiting the owner; an agent must not build on them |

## How it maps to AI-POS
| AI-POS layer | Here |
|---|---|
| `project_context.md` (index) | `.ai-context/project_context.md` |
| `rules/general` + `rules/<platform>` | `.agent/rules/` — `agent-role`, `constitution`, and one standards file per platform |
| `workflows/` | `.agent/workflows/` |
| `knowledge/domains/` | Per-feature `specs/` + `ownership_index.md` (the hybrid guide's choice) |
| `knowledge/technical/<platform>/` | `architecture.md` (single file; split by platform if it outgrows that) |
| `plans/<platform>.md` | `plans/<slug>.plan.md` — vertical slices across both apps |
| `state/`, `decisions/`, `memory/` | Same folders, same triggers |
| Monorepo placement: one root context shared by all apps | Followed — ADR-0002 |

What the comparison document says is lost by dropping Gate 1 — the one control that catches an
ambiguous spec before generation — is recorded in ADR-0001 together with what stands in for it.
