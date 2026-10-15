# Project Constitution

Written once. Every plan's `Constitution Check` verifies against this file. A change here needs
an ADR. **Precedence:** if a spec, plan or task conflicts with anything below, this file wins —
stop, raise it, and fix the spec.

## Testing Discipline
- **Frameworks:** Vitest (unit + integration), Supertest (HTTP), Playwright (E2E + visual).
  Proposed in ADR-0007; the constitution follows that ADR once the owner accepts it.
- **Integration testing:** run against a real MongoDB process (`mongodb-memory-server` locally
  and in CI, or a containerised `mongod`). Never mock Mongoose models or the driver — a mocked
  data layer hides responses that are not actually backed by stored data.
- **Test file location:** colocated with the code under test (`<name>.spec.ts` next to
  `<name>.ts`). Playwright specs are the one exception: `apps/web/e2e/`.
- **Coverage floor:** 80% lines and branches on `apps/api/src/modules/**/**.service.ts`, enforced
  in CI (proposed, ADR-0007). No floor is claimed for any other path until one is enforced.
- **Test-first scope (mandatory, no exceptions):**
  - Any new or changed API endpoint
  - Anything touching auth, sessions, uploads or PII
  - Every AI provider adapter, including the dev-bypass guard — tested in both directions: the
    stub activates when the provider is unconfigured outside production, and it does **not**
    activate when a provider is configured or when `NODE_ENV=production`
  - Every publish rule (`IPublishRule`) — one passing and one failing fixture each
  - Exempt: bug fixes that ship with a regression test, copy changes, config tweaks
- **Per-layer convention:** Repository tests hit a real datastore. Service tests use a
  constructor-injected fake of each interface and touch no datastore. Controller tests hit the
  real route and assert status code and response shape, not business logic already covered at
  the Service layer.
- **Substitutability tests:** every interface with more than one implementation has one shared
  contract suite that runs against each implementation (see Liskov, below).
- **Regression rule:** a bug fix ships with a test that fails against the pre-fix code, and gets
  a matching entry in `memory/pitfalls.md`, cross-referenced to the test.

## Security Posture
- **Never hardcode business payloads** in controllers, services or React components. Every
  response is backed by stored records created through schemas and idempotent seeders. The
  reference portfolio content is seed data (`apps/api/src/seed/data/`), never an inline literal.
- **Model output is data, never code.** AI providers return a JSON `DesignSpec` that is
  schema-validated server-side. HTML, CSS, JavaScript or URLs produced by a model are never
  stored, rendered or executed (ADR-0006).
- **Dev-bypass guard for the AI integration:** when no provider is configured **and**
  `NODE_ENV !== 'production'`, `DesignGeneratorFactory` returns `StubDesignGenerator`, which
  answers from a fixture so the rest of the flow works without a network. The decision lives in
  exactly one place:
  ```typescript
  if (env.NODE_ENV !== 'production' && !env.AI_PROVIDER) return new StubDesignGenerator();
  ```
  **This bypass must NEVER activate in production.** In production, startup fails fast when
  `AI_PROVIDER` is missing, is `ollama` or `stub`, or its credential is absent. Every new
  integration follows the same shape; this is a self-review checklist item.
- **Auth boundary:** `users` is the only authentication source. See `agent-role.md` → Auth.
- **Draft isolation:** `/api/v1/public/**` reads published snapshots only. No code path under
  that mount may import a draft repository interface.
- **Plain text only:** every free-text field is stored and rendered as text. HTML is stripped on
  write; React renders strings, never `dangerouslySetInnerHTML`.
- **URLs:** stored links are `https:` or `mailto:` only, validated on write and again at publish.
- **Uploads:** MIME is detected from magic bytes, not the extension or the client header; size is
  capped before the stream is buffered; SVG is rejected.
- **PII / logging rules:** never log secrets, tokens, passwords, cookies, prompt text or email
  addresses — including in agent-authored logs such as `state/prompt_history.md`. The owner's
  phone number is not part of any schema and must not be added without an ADR.
- **Secrets:** environment variables only, validated at startup by `config/env.ts`. Model IDs and
  provider URLs are configuration, never literals in code.
- **Security hardening backlog** (kept current, not aspirational):
  - `helmet()` — ⬜ `monorepo-foundation.T05`
  - Rate limiters (auth, AI, public) — ⬜ `monorepo-foundation.T05`, `owner-auth.T05`
  - Origin allow-list on state-changing CMS requests — ⬜ `owner-auth.T05`
  - Input sanitisation for free-text fields — ⬜ `section-engine.T03`
  - File upload MIME / size validation before storage — ⬜ `media-assets.T03`
  - Encryption at rest for sensitive fields — not applicable yet: the only secret at rest is the
    password hash (argon2id) and hashed refresh tokens

## Architectural Constraints

### Layer responsibilities — strict boundaries
| Layer | Responsibility | Must NOT |
|---|---|---|
| Repository | MongoDB queries only; maps documents to domain types | Contain business logic, validation, hashing; return Mongoose documents |
| Service | Business logic only; receives interfaces via constructor | Import Mongoose or `express`; read `process.env`; know about HTTP |
| Controller | HTTP in/out only; reads `req.validated*`, delegates to a service | Contain business logic; call a repository |
| Adapter | Translates one external system's wire format to a port | Contain business rules; be imported outside `container.ts` |

- **Dependency flow:** `Controller → IService → IRepository → Mongoose model`. Only interfaces
  cross a layer boundary. No concrete class imports another concrete class.
- **Structural non-negotiable:** `apps/api` is fully class-based — no function-based services,
  repositories, controllers or adapters. Pure helper functions are allowed only in `core/`.
- **Composition root:** `apps/api/src/container.ts` is the only file that instantiates services,
  repositories, adapters and controllers. `new` of any of those elsewhere (tests excepted) is a
  lint error. No service locator, no global registry lookups from inside a class.

### Module boundaries
- One folder per module under `apps/api/src/modules/<name>/`, using the module file pattern in
  `int-standards.express.md`.
- A module's public surface is `modules/<name>/index.ts`, which exports **interfaces and types
  only**. Other modules import from that file and nowhere deeper.
- Each MongoDB collection has exactly one writing module — the table is owned by
  `.ai-context/architecture.md` → Data ownership.
- Module dependencies form a DAG. The allowed edges are listed in `architecture.md` → Module
  dependency map; adding an edge requires updating that map in the same change.
- Cross-module reactions go through `IEventBus` (publish → revalidate), never a direct call from
  the emitting module into the reacting one.
- Enforced by lint import-boundary rules and an architecture test in CI — a boundary that is only
  documented is treated as not existing.

### SOLID — how each principle is enforced here
| Principle | Rule in this codebase | Check |
|---|---|---|
| Single Responsibility | One class, one reason to change. Layers above; prompt building, provider transport and output parsing are three classes, not one | Self-review: can the class's job be said without "and"? |
| Open / Closed | New section type, AI provider, publish rule, storage backend or layout variant is **added** as a new class registered in a registry — existing engine code is not edited | Diff touches only new files + one registration line |
| Liskov Substitution | Every implementation of an interface passes that interface's shared contract suite; adapters never throw provider-specific error types across the port | Contract suite in CI |
| Interface Segregation | Interfaces are role-sized: readers split from writers (`IDesignReader` / `IDesignWriter`), health checks split from generation | No consumer depends on a method it never calls |
| Dependency Inversion | Constructor injection of interfaces only; the interface is owned by the consuming side | Lint: no concrete cross-module or cross-layer imports |

### Approved LLD patterns (use these seams; do not invent parallel ones)
| Pattern | Where | Why |
|---|---|---|
| Repository | every module | Isolates Mongoose; makes services testable with fakes |
| Strategy + Registry | `SectionRegistry`, `PublishRuleRegistry`, layout variant registry | Open/Closed for section types, publish rules, variants |
| Adapter + Factory | `IDesignGenerator` (Gemini / OpenRouter / Ollama / Stub), `IFileStorage` | Provider chosen by configuration, no code change |
| Decorator | `TimeoutDesignGenerator`, `RetryDesignGenerator` | Cross-cutting behaviour without touching adapters |
| Pipeline (Chain of Responsibility) | `PublishPipeline` of `IPublishStep` | Ordered, individually testable publish stages |
| Observer (in-process events) | `IEventBus` — `portfolio.published` → site revalidation | Decouples publishing from the web app |
| Builder | `SnapshotBuilder` | Deterministic assembly + canonical hashing |
| Singleton | MongoDB connection only | One pool; see below |

A pattern not in this table needs an ADR. A pattern from this table is used only where its seam
is real — no interface with a single trivial implementation and no second implementation planned.

### Infrastructure
- **Singleton for the DB connection:** one Mongoose connection via a global cache to prevent
  connection leaks on hot-reload; production skips the cache so the process restarts cleanly.
- **Startup sequence must verify reachability before serving traffic:** load and validate env →
  connect to MongoDB and confirm it succeeded → build the container → recover interrupted work
  (stale `pending` AI proposals) → listen. Fail fast (`process.exit(1)`) on startup DB failure.
- **Approved datastores and integrations:** MongoDB (including GridFS for files). Gemini,
  OpenRouter and Ollama for design generation. No new datastore, queue, cache or external service
  without an ADR — that includes Redis and S3.

## Non-Functional Baselines
- **Status:** any target still unset reads "not yet defined" rather than a soft adjective.
- **Latency targets:** `GET /api/v1/health` — 200 ms at p95 (gates readiness checks). CMS and
  public read routes — not yet defined; set from the first measured baseline.
- **AI generation:** bounded by `AI_TIMEOUT_MS` (configuration). A numeric default per provider
  is not yet defined — measure Ollama locally and Gemini/OpenRouter before fixing one.
- **Public page performance (Core Web Vitals, Lighthouse):** not yet defined — set after
  `public-site-rendering` produces a first measured baseline.
- **Accessibility:** WCAG 2.1 AA on the public site and the CMS. Text/background contrast of at
  least 4.5:1 is checked by code at design save and at publish, not by eye.
- **Availability target:** not yet defined (single-owner personal product).
- **RPO / RTO:** not yet defined — depends on the MongoDB hosting chosen at deploy time.

## Versioning Rules
- **API:** routes are mounted under `/api/v1`. A breaking change to any `<slug>.API<NN>` contract
  needs either a new version mount or a superseding spec revision — never a silent change.
- **OpenAPI document:** semver in `info.version`. Bump the minor digit in the same PR that adds
  or changes a route; bump the patch digit for doc-only corrections.
- **Snapshot schema:** `snapshots.schemaVersion` is an integer. Any change to the published
  content shape bumps it and ships a reader that still renders every older version — published
  snapshots are immutable and are never migrated in place.
- **Section payloads:** additive optional fields are non-breaking. Removing or retyping a field
  is breaking and needs a data migration task in the same spec.
