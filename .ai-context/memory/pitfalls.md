# pitfalls.md — a specific technical trap

### 2026-10-15 — ESLint "Cannot find package '@eslint/js'" right after switching branches
**Root cause:** `node_modules/` had been committed early on and was later untracked
(`chore: stop tracking node_modules`). Checking out a branch where git no longer tracks those
files makes git delete them from the working tree, leaving `node_modules` partially empty.
**Fix:** run `pnpm install` after switching across that commit. `node_modules/` is now ignored
and untracked, so this cannot recur once every active branch contains the untrack commit.
**Regression test:** none — tooling state, not a code path.

### 2026-10-17 — `pnpm dev`: web fails with `API_INTERNAL_URL` invalid although it is exported
**Root cause:** two separate traps. (1) Turborepo 2 runs in strict env mode: a task receives
only the variables `turbo.json` declares, so shell-exported `PORT`, `MONGODB_URI` and
`API_INTERNAL_URL` never reached either app. (2) Once passed through, `next dev` also honours
`PORT` and took the API's port, so the API failed with `EADDRINUSE`.
**Fix:** `turbo.json` → `dev.passThroughEnv` lists every variable the apps read in
development, and `build.env` lists the ones read at build; the web `dev` script pins
`--port 3000`. The rule is stated in `architecture.md` → Environment.
**Regression test:** none — tooling configuration; verified by running `pnpm dev` and
fetching `/api/v1/health` from the web origin (`monorepo-foundation.T08`).

### 2026-10-17 — `next typegen` (and so `typecheck`) demands `API_INTERNAL_URL`
**Root cause:** Next.js 16 `typegen` loads `next.config.ts` in the production-build phase and
evaluates `rewrites()` to generate route types, so validating the environment there makes a
type check depend on a runtime URL.
**Fix:** `apps/web` `typecheck` runs `tsc --noEmit` alone; `next build` still type-checks with
the generated route types. Revisit if a later task needs typed routes in `typecheck`.
**Regression test:** none — verified by `env -u API_INTERNAL_URL pnpm turbo run typecheck`.

### 2026-10-17 — An untracked `apps/web/AGENTS.md` appears after `next dev`
**Root cause:** Next.js 16 writes a managed `AGENTS.md` into the app when it detects an AI
coding agent (`agentRules`, default `true`). This repository keeps agent context at the root
(ADR-0002), so the file would be a second, framework-owned instruction source.
**Fix:** `agentRules: false` in `apps/web/next.config.ts`; with it off, `next dev` removes the
block it wrote.
**Regression test:** none — framework behaviour, guarded by the config flag.

### 2026-10-17 — Turborepo dry run reports tasks that can never run as cache misses
**Root cause:** `turbo run <tasks> --dry=json` lists every package × task pair, including
packages with no script for that task. Those entries have `command: "<NONEXISTENT>"` and
`cache.status: "MISS"` even right after a fully cached run, so a naive "every task is a HIT"
check always fails.
**Fix:** `scripts/check-turbo-cache.mjs` ignores entries whose command is `<NONEXISTENT>`.
**Regression test:** `monorepo-foundation.IT13` (the CI step running that script).

### 2026-10-17 — A test that reads `.ai-context/architecture.md` stays cached after the doc changes
**Root cause:** Turborepo's default task inputs are the files of the package being run. IT14
(`apps/api`) and the `.env.example` drift tests read `architecture.md` at the repository root, so
editing the doc left their `test` tasks as cache hits and a stale pass could be replayed — in
CI too, once a remote cache is used.
**Fix:** `turbo.json` → `test.inputs` adds `$TURBO_ROOT$/.ai-context/architecture.md` beside
`$TURBO_DEFAULT$`. A new test reading another root file adds that file there too.
**Regression test:** none automated — verified by `turbo run test --dry=json` reporting `MISS`
for every `test` task after editing the doc (`monorepo-foundation.T10` DoD line).

<!-- Template
### <date> — <symptom>
**Root cause:** ...
**Fix:** ...
**Regression test:** <slug>.<test id>
-->
