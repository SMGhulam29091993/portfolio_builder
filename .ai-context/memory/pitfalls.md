# pitfalls.md — a specific technical trap

### 2026-10-15 — ESLint "Cannot find package '@eslint/js'" right after switching branches
**Root cause:** `node_modules/` had been committed early on and was later untracked
(`chore: stop tracking node_modules`). Checking out a branch where git no longer tracks those
files makes git delete them from the working tree, leaving `node_modules` partially empty.
**Fix:** run `pnpm install` after switching across that commit. `node_modules/` is now ignored
and untracked, so this cannot recur once every active branch contains the untrack commit.
**Regression test:** none — tooling state, not a code path.

<!-- Template
### <date> — <symptom>
**Root cause:** ...
**Fix:** ...
**Regression test:** <slug>.<test id>
-->
