# State Tracking Rule

Single source of truth for how every `.ai-context/` subfolder stays current.

## On every completed task
1. Append an entry to `state/prompt_history.md`:
   ```
   ### [YYYY-MM-DD HH:MM IST] — <slug>.T<NN>
   **User Request:** (one sentence)
   **Agent Action:** (files touched, migrations, decisions)
   ```
   Never log secrets, tokens, prompt text sent to a provider, or PII.
2. Update, every time — not an afterthought:
   - `state/current.md` — what is in progress right now
   - `state/completed.md` — move the just-finished item here, with its DoD self-check line
   - `state/next.md` — what is queued next
   State files must never go stale. Skip only for pure read-only questions that change nothing.
3. If the spec changed lifecycle state, update its `Status` block and its row in `status.md`.

## Commit-status claims — verify, don't assert
Never write a commit-status claim ("not yet committed") into `current.md`, `completed.md` or
`next.md` as a permanent fact — it goes stale the instant the user commits. Run `git log` /
`git status` before writing or trusting one. If something is uncommitted, phrase it so it ages
safely (reference the commit once it exists).
`state/prompt_history.md` is the one exception — an append-only log of what was true at that
moment; do not "fix" old entries.

## Plan / task step lifecycle
When working through a `tasks/<slug>.tasks.md` file:
- Mark a step `inprogress` (`- [~]`) before writing any code for it, not after.
- Work through it one sub-step at a time — do not jump ahead.
- Mark it `completed` (`- [x]`) only once every sub-step is done, verified, and the self-review
  in `.agent/workflows/code-review.md` has passed. A step with any deferred or blocked sub-task
  stays `inprogress`.
- If a later step is worked ahead of an earlier one, do not smooth it over in `status.md` or
  `state/` — note the deviation, and note when it resolves.

## Memory updates (`memory/`)
- **`pitfalls.md`** — a bug whose root cause was not obvious: symptom → root cause → fix.
- **`lessons.md`** — the *approach* was wrong: a corrected assumption, a validated approach.
- **`patterns.md`** — the same implementation approach recurs in two or more modules; name it
  so the next module reuses it.
- **`review-findings.md`** — a real finding from a `code-review.md` self-review pass, or one
  the owner points out.
All four start empty. Populate only with real, specific events. Never backfill a fabricated
incident to make a file look lived-in.

## Decision records (`decisions/`)
Create a numbered ADR only for a resolved ambiguity (a contradiction between sources, a schema
design choice, a tooling choice) — never for a routine implementation choice. An ADR marked
`Proposed` is not yet a fact: do not build on it without the owner's acceptance.

## Ownership Index
Any fact a second file needs is registered in `ownership_index.md` in the same change that
introduces the second reference. The second file links; it does not restate.

## Workflow docs (`.agent/workflows/`)
Update a workflow file only when the **process** changes (a new lint rule, a different test
framework) — not when the codebase changes.

## Cross-reference: `governance.md`
`governance.md` holds the triggers that extend the sections above: the state-file staleness
check, the Definition of Ready / Definition of Done checklists, the decision → `architecture.md`
promotion rule, and the archival policy.
