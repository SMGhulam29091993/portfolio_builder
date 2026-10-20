# lessons.md — a wrong assumption about *approach* (process-shaped)

### 2026-10-17 — Built-in ESLint rules cannot express "fails naming the rule" per boundary
**What we assumed:** `monorepo-foundation.T07` could use ESLint's built-in
`no-restricted-imports` and `no-restricted-syntax` with file-scoped options, avoiding a plugin.
**What was actually true:** AC9 asks for a failure that names the broken rule. Built-ins report
(a) and (b) under one id and (c) and (d) under another, and (d) has to follow an import back to
the class declaration, which a syntax selector cannot do. A small local plugin
(`packages/eslint-config/plugin/`) gives one id per boundary and uses the type checker, with no
new dependency.
**Carry forward:** when an acceptance criterion asks a tool to *name* what failed, pick the
mechanism by the identifier it reports, not only by whether it can detect the case.

### 2026-10-18 — `npx prettier --write` is not this repo's formatter
**What we assumed:** running Prettier over the edited files would apply the repo's style.
**What was actually true:** there is no Prettier config, so it applied its defaults (double
quotes, 80 columns) and rewrote every file it was given, including untouched ones. The code
follows single quotes, 100 columns and trailing commas, and only ESLint is enforced (`pnpm
lint`). Objects Prettier had already split stay split on a second run with the right options.
**Carry forward:** do not run Prettier over existing files. If formatting help is wanted, pass
`--single-quote --print-width 100 --trailing-comma all` and only on new files, then check
`git diff` for reformatting noise before committing.

### 2026-10-18 — A task that creates a record needs a stated source for every required field
**What we assumed:** `owner-auth.T09` was fully specified by AC13 and AC14: a seeder from
`OWNER_EMAIL` / `OWNER_PASSWORD`.
**What was actually true:** `users.displayName` is required (model, `NewUser`, API04), and no
document said where the seeded value comes from. Asking instead of picking a default surfaced a
product change: open registration, a one-time owner claim, Google sign-in and per-user
portfolios (ADR-0010, ADR-0011). The seeder became development-only.
**Carry forward:** before starting a task that writes a new record, list the record's required
fields against the spec; any field without a source is an Open Question, raised before code.

<!-- Template
### <date> — <one-line summary>
**What we assumed:** ...
**What was actually true:** ...
**Carry forward:** ...
-->

### 2026-10-20 — a multi-line shell step does not stop at a failed line
Two commits on `feat/full-build` (account-registration.T02, google-sign-in.T02) went in with
lint errors or missing records, because the failing command was one line of a multi-line
step and only the first line was chained with `&&`; `set -e` did not stop an embedded
`python3 -` heredoc either. Approach now: run the full gate script
(`build typecheck lint test drift`) as its own step and commit only after it exits 0; record
edits run in a script that exits non-zero on the first miss, followed by `|| exit 1`.
