# Governance

## Review gates — none on this project
Gate 1 (spec peer review) and Gate 2 (code review by a named reviewer) are **not used**
(ADR-0001, decided by the owner on 2026-10-11). There are no reviewer roles, no `Reviewed by:`
lines, no review dashboard and no reviewer tripwire. The two checklists below still apply — they
are run by the author and the agent as self-checks, and CI is the only independent control.

## Roles
- **Author of record and owner:** S M Ghulam Ghaus Faiyaz. Every spec and diff produced at his
  instruction is authored by him. He alone moves a spec from `Draft` to `Ready`.

## Standing authorisation to move specs to `Ready` (owner, 2026-10-20)
The owner authorised the agent to move any spec `Draft → Ready` once it has been revised to the
owner's recorded answers and its Definition of Ready self-check passes, so the remaining build
runs without a stop per spec. The agent records each such move as "by the agent under the
owner's standing authorisation of 2026-10-20". A new question only the owner can answer still
stops the build; it is never answered by the agent.

## Spec lifecycle
`Draft → Ready → In Progress → Implemented → Released` (and `Deprecated`).
| Transition | Who | Condition |
|---|---|---|
| Draft → Ready | Owner says so, or the agent under the standing authorisation above; agent records it | Definition of Ready passes; no unresolved Open Question; every ADR the spec depends on is `Accepted` |
| Ready → In Progress | Agent | First task marked `inprogress` |
| In Progress → Implemented | Agent | Every task `completed`, each with a DoD self-check line |
| Implemented → Released | Owner | Deployed |
The agent writes each transition into the spec's `Status` block and `status.md`.

## Definition of Ready (self-check before a spec becomes `Ready`)
- Intent fits in one paragraph a zero-context engineer or agent could build from.
- Acceptance criteria are given/when/then, not adjectives.
- API Contract (if any), Edge Cases and Error Handling are filled in — no placeholders.
- Anything explicitly out of scope is named.
- A linked BRD entry exists.
- Open Questions is empty, or each item is marked resolved with the answer.
- No acceptance criterion requires breaking `constitution.md`.
Record as `DoR self-check: <date>, pass` in the spec's `Status` block.

## Definition of Done (self-check before a task is `completed`)
- Every item in `.agent/workflows/code-review.md` is checked.
- CI is green: typecheck, lint (including import boundaries), tests, coverage floor, OpenAPI
  drift check.
- `status.md` reflects the change; `state/current.md`, `next.md`, `blockers.md` match reality.
- Any new shared fact has an owner in `ownership_index.md`.
- A real mistake or reusable pattern found during the task is in the right `memory/` file.
- The plan's `Explicitly Deferred` section was checked — no scope creep into it.
- If a decision made in this task is now stable, `architecture.md` states the resulting fact in
  plain present tense (episodic → semantic promotion) — not left as an ADR-only fact.
- `DoD self-check: <date>, pass` recorded against the task in `state/completed.md`.

## Material revision of a spec
If a spec changes *materially* after it is `Ready` (payload redesign, added or removed AC,
changed error contract — not a field rename), do not rewrite history. Append to its `Status`
block: `⚠️ REVISED <date> (<reason>)`, set the status back to `Draft` if implementation has not
finished, and re-run the Definition of Ready.

## State-file staleness (extends `state-tracking.md`)
If `state/current.md` has not been updated in 5+ working days despite commits in that window,
the next session flags it before doing anything else.

## Archival policy
- `decisions/archive/` — a decision superseded for more than 3 months moves here; the
  superseding decision keeps a one-line pointer back. Nothing is deleted.
- `memory/` — `lessons.md` and `pitfalls.md` are **never archived by age**, only once an entry is
  structurally impossible to repeat (a lint rule, a type constraint), noted inline.
- A deprecated spec is archived, not deleted; its slug is never reused.

## Status
The lifecycle is in use: `monorepo-foundation` moved `Draft → Ready → In Progress` on
2026-10-15 and `In Progress → Implemented` on 2026-10-17, and every completed task carries a DoD
self-check line in `state/completed.md`. `owner-auth` moved `Draft → Ready → In Progress` on
2026-10-17, back to `Draft` on 2026-10-18 under a `⚠️ REVISED` marker (multi-tenancy,
ADR-0010) with T01–T08 completed, `Draft → Ready → In Progress` again on 2026-10-19 and
`In Progress → Implemented` the same day with T09. From 2026-10-20 the agent moved the remaining
specs to `Ready` under the standing authorisation above, and by 2026-10-21 every written spec is
`Implemented` (`status.md` holds the dates). Restoring review gates later means superseding
ADR-0001 and re-adding the reviewer roles here — nothing else needs to move.
