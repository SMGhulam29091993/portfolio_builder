# Portfolio Builder — Project Context Index

## Summary
Portfolio Builder is a single-owner CMS panel that edits, designs and publishes a personal
portfolio site. The site to publish is the reference design in `docs/design-reference/`
(hero, about, selected work, experience, stack, contact). Turborepo monorepo: `apps/api`
(Express, TypeScript, MongoDB) and `apps/web` (Next.js — public site and CMS). AI design
generation runs on Gemini or OpenRouter, and on Ollama locally. **Phase: `monorepo-foundation`
implemented 2026-10-17; `owner-auth` (revised 2026-10-17: Redis session, OTP password reset) is
in progress.**

## Current sprint
Spec set authored 2026-10-11. `monorepo-foundation` is `Implemented`; `owner-auth` is
`In Progress` (T01–T05 completed 2026-10-17, T06–T07 2026-10-18); the other 14 specs are `Draft`. Live picture: `state/current.md`,
`state/next.md`, `state/blockers.md`. Spec-level view: `status.md`.

## Architecture, in one paragraph
A class-based modular monolith in `apps/api`: each module is controller → service → repository
behind interfaces, wired in one composition root, with one writing module per collection.
Content is typed sections behind a registry; publishing freezes the draft into an immutable
snapshot and swaps a pointer; the Next.js site renders only the current snapshot through
shared section components that the CMS preview also uses. MongoDB is the system of record;
Redis holds only the `auth` module's sessions and one-time-code references (ADR-0008). Full detail: `architecture.md`.

## Critical, non-negotiable rules
- SOLID and module boundaries override everything — `constitution.md` → Architectural Constraints.
- `apps/api` is class-based only; classes are instantiated only in `container.ts`.
- Never hardcode business payloads; model output is data, never code — `constitution.md` → Security Posture.
- Never guess a design value — `design_reference.md` → Unknowns.
- Every new or changed route updates the OpenAPI document in the same change — `int-standards.express.md`.
- State files must never go stale — `state-tracking.md`.
- No review gates; run the self-review before completing any task — `governance.md`, ADR-0001.
- A `Proposed` ADR is not a fact; do not build on it — `state-tracking.md`.

Full rule text: `.agent/rules/agent-role.md`, `constitution.md`, `int-standards.express.md`,
`int-standards.nextjs.md`, `governance.md`.

## Index

### Rules (`.agent/rules/`)
- `agent-role.md` — identity, route audiences, behavioral rules — read first
- `constitution.md` — testing / security / architecture / SOLID / NFR / versioning
- `int-standards.express.md` — `apps/api` conventions: module pattern, envelope, error codes
- `int-standards.nextjs.md` — `apps/web` + UI packages conventions
- `state-tracking.md` — state / memory / decision update triggers
- `governance.md` — lifecycle, Definition of Ready / Done, archival (no gates)

### Workflows (`.agent/workflows/`)
- `generate-plan.md` · `implement-task.md` · `generate-tests.md` · `code-review.md`
  (self-review) · `spec-readiness-check.md`

### Requirements & delivery
- `BRD.md` — numbered business requirements, upstream of every spec
- `design_reference.md` — what the attached HTML contains; the content and visual source
- `specs/`, `plans/`, `tasks/`, `test_cases/` — one set per feature slug; board in `status.md`

### Feature slugs (build order)
`monorepo-foundation` → `owner-auth` → `section-engine` → `cms-panel-shell` → `site-identity`
→ `media-assets` → `design-theme` → `hero-section` · `about-section` · `work-showcase` ·
`experience-timeline` · `stack-credentials` · `contact-section` → `publish-pipeline` →
`public-site-rendering` → `ai-design-studio`

### State (`state/`)
- `current.md` · `completed.md` · `next.md` · `blockers.md` · `prompt_history.md`

### Decisions (`decisions/`)
- ADR-0001 no review gates (Accepted) · ADR-0002 root context in Turborepo (Accepted) ·
  ADR-0003 AI provider port (Accepted / mechanics Proposed) · ADR-0004 snapshot publishing
  (Proposed) · ADR-0005 section registry (Proposed) · ADR-0006 AI output is constrained data
  (Proposed) · ADR-0007 tooling baseline (Accepted, amended 2026-10-17) · ADR-0008 Redis
  session store (Accepted) · ADR-0009 mail delivery (Accepted)

### Memory (`memory/`)
- `lessons.md` · `patterns.md` · `pitfalls.md` · `review-findings.md` — real events only;
  `patterns.md` is still empty, the other three hold entries from `monorepo-foundation` and
  `owner-auth`

### Ownership Index
- `ownership_index.md` — one canonical owner per fact referenced by 2+ files
