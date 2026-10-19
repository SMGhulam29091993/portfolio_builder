# Portfolio Builder

A Turborepo project, specified and tracked with a hybrid SDD + AIPOS context system: a CMS panel
that edits, designs and publishes the portfolio in `docs/design-reference/`.

**Stack:** Next.js · Node.js + Express · TypeScript · MongoDB · Gemini / OpenRouter for AI design
generation, Ollama for local development.
**State:** the `monorepo-foundation` spec is implemented (workspace, API bootstrap, `GET
/api/v1/health`, boundary lint, OpenAPI drift check, web scaffold, CI). Feature specs follow in
the build order below; live status is in `.ai-context/status.md`.

## Local development
**Prerequisites:** Node.js 24.12 or later, pnpm 11.1.2 (`corepack enable` picks up the version
pinned in `package.json`), and Docker with Compose for the local MongoDB and Redis.

```sh
pnpm install                                        # also downloads mongod for the test suites
cp apps/api/.env.example apps/api/.env              # works as is against the compose MongoDB and Redis
cp apps/web/.env.example apps/web/.env
docker compose -f docker-compose.dev.yml up -d --wait
pnpm dev                                            # API on :4000, web on :3000
```

Check it end to end: `curl http://localhost:3000/api/v1/health` goes through the web app's
`/api/v1` proxy to the API and answers `200` with `"db": "up"`.

- **Environment.** Each `.env.example` lists every variable its app will ever read
  (`.ai-context/architecture.md` → Environment). Uncommented lines are read today; commented
  ones belong to a later spec and stay off until it lands. The API refuses to start, naming the
  variable, when one is missing or malformed. Copied `.env` files are git-ignored — never commit
  a real secret. A variable added to an app also goes into `turbo.json`, because Turborepo runs
  in strict env mode.
- **MongoDB.** `docker-compose.dev.yml` runs `mongod` 8.2.6 — the version the tests use — on
  `127.0.0.1:27017` only, without authentication, with data in the `mongo-data` volume. Stop it
  with `docker compose -f docker-compose.dev.yml down`; add `-v` to delete the data as well.
- **Redis.** The same file runs Redis 8.10.2 on `127.0.0.1:6379`, loopback only, without a
  password or persistence: it holds only auth sessions and one-time-code references, which are
  safe to lose (ADR-0008). `pnpm dev` uses logical database 0. An existing `apps/api/.env` needs
  the `REDIS_URL` line from `.env.example` added, or the API refuses to start — and since
  `owner-auth.T05` the `JWT_ACCESS_SECRET` line too (at least 32 characters; replace the
  development placeholder with `openssl rand -base64 48`), and since `owner-auth.T06` the
  `WEB_ORIGIN` line (`http://localhost:3000`). Every non-GET to `/api/v1/auth` or `/api/v1/cms`
  must carry exactly that `Origin`, so open the web app on the same host spelling — a
  `127.0.0.1:3000` tab gets 403 `ORIGIN_NOT_ALLOWED` — and send `-H 'Origin: …'` with `curl`.
- **Mail is optional locally.** Since `owner-auth.T07` the API reads `GMAIL_USER`,
  `GMAIL_APP_PASSWORD` and `MAIL_FROM` (ADR-0009). Left blank, mail is disabled and only
  password reset is affected (it answers 503). To send real reset codes, set a Gmail address
  and a Gmail app password — never the account password. With `NODE_ENV=production` the API
  refuses to start until both are set.
- **Tests need the compose Redis running.** They start their own throwaway `mongod`, but Redis
  has no in-memory server: each API spec file claims its own logical database (1-14) on the
  compose Redis, and the E2E harness uses database 15, so tests never touch development data.
  Start it with `docker compose -f docker-compose.dev.yml up -d --wait redis`; CI runs the same
  image as a service container.

| Command | Runs |
|---|---|
| `pnpm turbo run build typecheck lint test drift` | Everything CI runs on a pull request (`.github/workflows/ci.yml`) |
| `pnpm test` | Unit and integration tests, with the 80% coverage floor on module services |
| `pnpm test:e2e` | Playwright end-to-end specs (boots its own API and MongoDB; uses the compose Redis) |
| `pnpm drift` | Fails when `apps/api/openapi/openapi.yaml` and the mounted routes disagree |
| `pnpm seed:owner` | Creates one local account from `OWNER_EMAIL` / `OWNER_PASSWORD` in `apps/api/.env` (12–200 characters; display name `Owner`). Running it again changes nothing; it refuses with `NODE_ENV=production`. Needs the compose MongoDB and a `.env` that also passes the API's own checks |

## Where to start
| You want to | Read |
|---|---|
| Orient a new session | `.ai-context/project_context.md` |
| See the rules an agent must follow | `.agent/rules/agent-role.md`, then `constitution.md` |
| See what the attached HTML contains | `.ai-context/design_reference.md` |
| See where each feature stands | `.ai-context/status.md` |
| See what is waiting on you | `.ai-context/state/blockers.md` |
| Understand the system design | `.ai-context/architecture.md` |

## What is here
```
apps/api/            Express + Mongoose API (class-based modules, composition root, OpenAPI)
apps/web/            Next.js App Router: the published site (site) and the CMS (cms)
packages/            contracts · design-tokens · sections · tsconfig · eslint-config
docker-compose.dev.yml   local MongoDB and Redis for `pnpm dev` and the tests
.github/workflows/ci.yml build · typecheck · lint · test · drift · cache check · E2E
.agent/rules/        agent-role · constitution · int-standards.express · int-standards.nextjs
                     state-tracking · governance · .agentignore
.agent/workflows/    generate-plan · implement-task · generate-tests · code-review · spec-readiness-check
.ai-context/         project_context · architecture · BRD · design_reference · ownership_index · status
  specs/ plans/ tasks/ test_cases/   one file each per feature slug (16 slugs) + _integration.md
  decisions/         ADR-0001 … ADR-0007
  state/ memory/     working state; lessons, pitfalls and review findings from real events
AGENTS.md CLAUDE.md GEMINI.md .cursor/ .windsurf/ .github/copilot-instructions.md   thin pointers to the rules
docs/design-reference/   the two boards extracted from the HTML export
```

## Feature slugs, in build order
| # | Slug | What it delivers |
|---|---|---|
| 1 | `monorepo-foundation` | Turborepo, API bootstrap, boundary lint, OpenAPI, CI |
| 2 | `owner-auth` | Owner sign-in, rotating sessions, the CMS guard |
| 3 | `section-engine` | Section registry, generic section API, page composer |
| 4 | `cms-panel-shell` | CMS frame, editor host, live preview at 1440 / 390 |
| 5 | `site-identity` | Name, email, socials, résumé link, footer, SEO |
| 6 | `media-assets` | Résumé / image upload behind a storage interface |
| 7 | `design-theme` | Theme tokens, layout variants, contrast enforcement |
| 8–13 | `hero-section` · `about-section` · `work-showcase` · `experience-timeline` · `stack-credentials` · `contact-section` | One per block of the reference page |
| 14 | `publish-pipeline` | Validate → snapshot → publish → rollback |
| 15 | `public-site-rendering` | Public API, site shell, SEO, visual fidelity |
| 16 | `ai-design-studio` | AI design proposals through a provider port |

## How this differs from the hybrid setup guide
| Guide | Here | Why |
|---|---|---|
| Gate 1 / Gate 2 reviewers, reviewer tripwire, review dashboard | Removed. DoR / DoD kept as self-checks; `code-review.md` is a self-review; `spec-readiness-check.md` replaces the dashboard | Owner's decision — ADR-0001 |
| `Reviewed by:` lines; `⚠️ SUPERSEDED … needs re-review` | `DoR self-check:` / `DoD self-check:` lines; `⚠️ REVISED` | No reviewer exists to name |
| One `int-standards.<stack>.md` | `int-standards.express.md` + `int-standards.nextjs.md`, each scoped to its app | Turborepo with two platforms — ADR-0002 |
| Entry files named `gate-review.*` carrying the reviewer tripwire | `project-entry.*` carrying a pointer to the rules; still byte-identical across tools | Nothing gate-related left to trip |
| — | `design_reference.md` | The spec source is a design export; its content needs one owner |
| — | `implement-task.md`, test ID prefixes `IT` / `CT` / `E2E` / `VR` | With no second reviewer, the task loop and test layers are spelled out |
| ADR template without a status | `Status:` line (`Accepted` / `Proposed`) | Four ADRs are proposals awaiting the owner; an agent must not build on them |

## How it maps to AI-POS
| AI-POS layer | Here |
|---|---|
| `project_context.md` (index) | `.ai-context/project_context.md` |
| `rules/general` + `rules/<platform>` | `.agent/rules/` — `agent-role`, `constitution`, and one standards file per platform |
| `workflows/` | `.agent/workflows/` |
| `knowledge/domains/` | Per-feature `specs/` + `ownership_index.md` (the hybrid guide's choice) |
| `knowledge/technical/<platform>/` | `architecture.md` (single file; split by platform if it outgrows that) |
| `plans/<platform>.md` | `plans/<slug>.plan.md` — vertical slices across both apps |
| `state/`, `decisions/`, `memory/` | Same folders, same triggers |
| Monorepo placement: one root context shared by all apps | Followed — ADR-0002 |

What the comparison document says is lost by dropping Gate 1 — the one control that catches an
ambiguous spec before generation — is recorded in ADR-0001 together with what stands in for it.
