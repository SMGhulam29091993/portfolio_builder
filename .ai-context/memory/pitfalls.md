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

### 2026-10-20 — web typecheck raced `next build` over `.next/types` (cms-panel-shell.T04, T05)
**Symptom:** `TS6053 File '.next/types/routes.d.ts' not found` from `@portfolio/web#typecheck`,
only when the web build actually re-ran (not when it was a cache hit).
**Root cause:** `apps/web/tsconfig.json` includes `.next/types/**/*.ts`; turbo ran
`typecheck` and `build` for the same package in parallel, and `next build` deletes and rewrites
`.next/types` while `tsc` has already listed the files.
**Fix:** `turbo.json` makes `@portfolio/web#typecheck` and `#lint` depend on
`@portfolio/web#build`, so they always read a complete `.next/types`.

### 2026-10-20 — reload right after a save hung an E2E journey (site-identity.T07)
**Symptom:** `site-identity.E2E01` hit the 60 s test timeout with no failing step named.
**Root cause:** the test reloaded immediately after the "saved" toast; React had not yet
re-rendered the reset form, so the panel's `beforeunload` guard (any dirty editor) was still
registered. Playwright dismisses `beforeunload` dialogs by default, which cancels the
navigation, so `page.reload()` never finished.
**Fix:** CMS forms expose `data-dirty` / `data-valid`; journeys wait for
`data-dirty="false"` before navigating away after a save (`e2e/cms-identity.spec.ts`).

### 2026-10-20 — zod skips an object's refinements once one of its fields failed (section specs T01)
**Symptom:** `about-section.AC2` listed `bio` and `stats` but not `process.steps`, though the
step-count rule was broken too.
**Root cause:** the rule was a `superRefine` on the whole section object; zod 4 does not run an
object's refinements when any of its fields already failed, so cross-field rules vanished from
a 400 that also had a plain field error.
**Fix:** each rule sits on the narrowest schema that owns its fields (the process card, a
project, an entry, a group, an array); every rule now reports in the same response. Covered by
`section-definitions.spec.ts`.

### 2026-10-21 — ai-design-studio.T05: a timeout reported as a provider error
**Symptom:** `TimeoutDesignGenerator` rejected with a plain `UpstreamError` when the time ran
out, so a slow provider would have been recorded as `PROVIDER_ERROR`, not `PROVIDER_TIMEOUT`.
**Root cause:** `AbortController.abort()` runs `abort` listeners synchronously. Aborting the
inner call made the adapter reject with its own `UpstreamError` *before* the timeout branch
returned its rejection, so that rejection won the `Promise.race`.
**Fix:** the decorator remembers the timeout error and rethrows it from `catch`, whatever settled
first. Regression test: `timeout.design-generator.spec.ts` → `ai-design-studio.UT09`. Applies to
any race between an aborted call and the reason it was aborted.

### 2026-10-21 — ai-design-studio.T10: E2E against a stale API build
**Symptom:** every new `/cms/ai` request in a Playwright run failed with "The request could not
be completed", though the route tests passed.
**Root cause:** `e2e/start-api.ts` runs the built `apps/api/dist`. `npx playwright test` run
directly does not rebuild it, so the E2E API predated the new routes and answered 404.
**Fix:** run `pnpm test:e2e` (turbo builds the API first), or `pnpm --filter @portfolio/api build`
before calling Playwright directly.

### 2026-10-21 — a hero created hidden on a portfolio older than its section types
**Symptom:** the owner's CMS preview was empty; the Work editor showed template placeholders.
**Root cause:** the dev portfolio was provisioned (2026-10-20) before any section type was
registered, so it got no sections and an empty order, and provisioning never runs again for an
existing portfolio. `section-engine.AC18` then shows each missing type hidden and stores it
hidden on its first save — applied even to the hero, which cannot be hidden, so the hero was
stored hidden with no way to show it. With every section hidden the preview drew nothing.
**Fix:** a type that cannot be hidden is shown, created, saved and published visible
(`SectionService.readDraft`, `updateSection`, `SectionsDraftContributor`); hideable types keep
AC18. The preview says when every section is hidden instead of showing an empty box, and sizes
its frame to the scaled page. Regression tests: `section.service.spec.ts` → "a section that
cannot be hidden (hero) is never hidden"; `sections-draft.contributor.spec.ts` → "publishes a
hero stored hidden…".

### 2026-10-21 — `window.location` still shows the old URL while a `router.replace` renders
**Symptom:** E2E14 failed intermittently: a `/auth/refresh` request was sent after a superseded
session landed on `/cms/login?notice=signed-out-elsewhere`, though the new sign-in guard skips
its check whenever `?notice=` is present.
**Root cause:** the guard first read the query from `window.location.search`. On a client-side
`router.replace`, Next.js renders the new route before it updates the window URL, so the guard
saw the previous page's query, missed the notice and checked the (just cleared) session.
**Fix:** read the query with `useSearchParams()` (the router's view of the target URL), inside a
`Suspense` boundary so statically rendered pages still build (`components/cms/signed-out-only.tsx`).

### 2026-10-21 — every AI proposal failed with `PROVIDER_ERROR` against real providers
**Symptom:** with Gemini, and with OpenRouter, each generation ended `PROVIDER_ERROR` and the
log said only `design proposal completed`; the contract suite and recorded answers all passed.
**Root cause:** two upstream refusals the service did not log. Gemini answered HTTP 400: the
answer schema carried a custom layout tree for all six sections (11 169 bytes, 64 `anyOf`
branches), more than its structured output accepts. OpenRouter answered HTTP 402: with no
`max_tokens` it reserves the model's whole output limit against the credits. Recorded answers
never send the schema to a real provider, so neither surfaced in tests.
**Fix:** `DesignPromptBuilder` adds `customLayouts` only for an explore request, one tree per
visible section; `AI_MAX_OUTPUT_TOKENS` is sent as `max_tokens`; the service logs
`design provider call failed` with the cause (`HTTP 4xx`, or only the error type otherwise).
Regression tests: `design-prompt.builder.spec.ts` → "the answer schema stays within what Gemini
accepts" (design-library.UT04); `ai-design.service.spec.ts` → "a provider failure logs its
upstream cause…". OpenRouter model ids are namespaced: `AI_MODEL=google/gemini-3.5-flash`, not
the bare Gemini id.
