# ADR-0002: One root `.agent/` + `.ai-context/`, with per-platform standards files
**Status:** Accepted — owner, 2026-10-11 (stated in the proposal; the owner proceeded on it)

## Context
The hybrid guide describes a single-app repository with one `int-standards.<stack>.md`. This
project is a Turborepo with an Express API and a Next.js app. The AI-POS setup guide's monorepo
section offers two placements: one root context shared by all apps, or one per app.

## Decision
One `.agent/` and one `.ai-context/` at the repository root. `apps/api` and `apps/web`
implement the same business domain, so specs, BRD, decisions, memory and state stay singular.
The platform split AI-POS asks for is applied where the hybrid guide left room for it: two
standards files, each stating its scope — `int-standards.express.md` (`apps/api/**`) and
`int-standards.nextjs.md` (`apps/web/**` and the UI packages). Feature specs are vertical slices
covering both apps. Shared packages each have one declared owner in `architecture.md`.

## Consequences
- A backend task and a frontend task for the same feature read the same spec.
- A task loads only its own standards file — the token-cost benefit AI-POS's platform split is
  for.
- `architecture.md` is a single file. If it outgrows comfortable reading, split it by platform
  the way AI-POS's `knowledge/technical/<platform>/` does; that is a size trigger, not done now.
- AI-POS's `knowledge/domains/` has no separate folder here: per-feature specs plus the
  Ownership Index carry domain facts, which is the hybrid guide's design.
