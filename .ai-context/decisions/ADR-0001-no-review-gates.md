# ADR-0001: No Gate 1 / Gate 2 reviewers on this project
**Status:** Accepted — owner, 2026-10-11

## Context
The hybrid SDD + AIPOS setup defines two human review gates with named reviewers, a reviewer
self-identification tripwire in six tool entry files, and a Gate Review Dashboard workflow. This
is a single-owner personal product: there is no second person to act as reviewer. The owner
stated the gates are not needed and should be skipped.

## Decision
Remove both gates. Specifically: no reviewer roles in `governance.md`; no `Reviewed by:` or
`Gate 2 reviewed by:` lines; no `gate-review-dashboard.md` workflow; the six entry files carry a
plain pointer to the rule files instead of a reviewer tripwire. Everything else in the hybrid
setup is kept: BRD traceability, per-feature files, Ownership Index, memory, state tracking,
ADRs, archival. The Definition of Ready and Definition of Done remain as self-checks, and
`code-review.md` becomes a self-review checklist run before a task is marked `completed`.

## Consequences
- Faster flow; no waiting on a reviewer who does not exist.
- **A control is lost.** In the SDD-vs-AI-POS comparison, Gate 1 is the one mechanism that
  catches an ambiguous spec *before* generation; structure alone does not replace it. A spec
  mistake now propagates into code, tests and docs with nothing independent in the way.
- Compensations, all automated or structural: an `Open Questions` section that blocks `Ready`;
  `Proposed` ADRs that may not be built on; CI as the only independent check (typecheck, lint
  with import boundaries, tests, coverage floor, OpenAPI drift, architecture test).
- A spec changed after `Ready` is marked `⚠️ REVISED`, replacing the `SUPERSEDED / needs
  re-review` convention.
- Reversible: restoring gates means superseding this ADR and re-adding roles to `governance.md`.
