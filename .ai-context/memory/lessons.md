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

<!-- Template
### <date> — <one-line summary>
**What we assumed:** ...
**What was actually true:** ...
**Carry forward:** ...
-->
