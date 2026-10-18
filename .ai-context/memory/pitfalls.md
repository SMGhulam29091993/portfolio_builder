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

### 2026-10-17 — An upsert stored an `otps` document with a purpose outside the schema enum
**Root cause:** On `findOneAndUpdate(..., { upsert: true, runValidators: true })`, Mongoose
validates only the paths named in update operators. `purpose` was in the filter alone, so the
inserted document took it from the filter, past the enum. `strict: 'throw'` does not catch it
either: the path exists in the schema, only its value is wrong.
**Fix:** `OtpRepository.upsert` repeats the filter keys in `$setOnInsert`, which makes them
update paths and so validated. Any upsert whose filter keys carry a schema constraint does the
same.
**Regression test:** `owner-auth` — `otp.repository.spec.ts` → "rejects a purpose outside the
allowed list" (failed before the fix).

### 2026-10-17 — Auth requests hang for as long as Redis is down instead of failing
**Root cause:** node-redis queues a command issued while the socket is reconnecting (its offline
queue is on by default) and sends it only once the server is back. `RedisConnection`'s comment
already said such commands "fail", but nothing tested it: a guarded request with Redis gone
waited until the test client gave up (5 s), where the spec wants an immediate 503.
**Fix:** `RedisConnection` creates the client with `disableOfflineQueue: true`, and Redis-backed
stores wrap every command in `whileRedisAvailable` (`core/redis`), which maps any failure to
503 `SERVICE_UNAVAILABLE` with the driver error as the logged cause.
**Regression test:** `owner-auth.IT13` — `modules/auth/auth-redis-outage.spec.ts` (cuts a TCP
proxy in front of Redis; fails at 5 s against the queueing client).

### 2026-10-18 — A container that fails to build leaves MongoDB and Redis open
**Root cause:** `ApplicationLifecycle.start` closed the datastores only when a *connect* failed.
Its doc comment already promised the same for a request handler that cannot be built, but the
handler was built outside the `try`, and nothing tested it — no container had ever thrown. The
first one that does is production without a mail strategy (`owner-auth.AC22`): the process
logged `startup failed` and lingered with both connections open until `main.ts`'s forced-exit
timer fired.
**Fix:** the handler is built inside the same `try`, so any failure closes every datastore,
newest first, before rethrowing.
**Regression test:** `owner-auth.AC22` — `core/lifecycle/application-lifecycle.spec.ts` →
"closes every datastore, newest first, and opens no port when the handler cannot be built"
(failed before the fix); end to end, `owner-auth.IT22` in `main.spec.ts`.

<!-- Template
### <date> — <symptom>
**Root cause:** ...
**Fix:** ...
**Regression test:** <slug>.<test id>
-->
