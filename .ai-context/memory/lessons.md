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

### 2026-10-21 — a global text replace hit code as well as copy
Renaming template placeholders by replacing `[0]` everywhere also turned `sectionTypes[0]` into
`sectionTypes[Your number]`; it surfaced only when the web build ran. **Carry forward:** replace
copy inside quotes only (match the quote too), and grep afterwards for the new text next to an
identifier (`[A-Za-z)\]][Your `) before the gate.

### 2026-10-21 — the Redis test pool was smaller than the number of Redis spec files
Sixteen spec files claim one of fourteen test databases, and crashed runs leave claims for ten
minutes, so a full run could fail every Redis suite at once. **Carry forward:** the harness now
waits (up to 45 s) for a free database; a new Redis-backed spec needs no other change.

### 2026-10-21 — two dialogs on one screen shared a title id
`ConfirmDialog` used a fixed `id`, so the second dialog was named by the first one's heading;
only the browser journey caught it. **Carry forward:** any id a reusable component renders comes
from `useId()`.


### 2026-10-21 — an "is absent" assertion proved nothing until the value was shown present
`ai-design-studio.IT11` edited a hero field the schema does not have, so the text was stripped
on save and "the provider never receives section text" passed trivially. **Carry forward:** a test
that asserts something is absent first asserts it exists where it should (here, in the draft),
so the absence means something.
