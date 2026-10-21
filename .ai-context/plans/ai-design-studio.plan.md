# Plan: AI Design Studio
## Derived From
.ai-context/specs/ai-design-studio.spec.md
## Architecture Approach
Module `apps/api/src/modules/ai-design/`, module file pattern plus `providers/` and `decorators/`.
| Class | Role | Implements | Depends on (interfaces) |
|---|---|---|---|
| `AiDesignController` | Controller | — | `IAiDesignService` |
| `AiDesignService` | Service — orchestration only | `IAiDesignService` | `IProposalRepository`, `IDesignGenerator`, `IDesignPromptBuilder`, `IDesignSpecParser`, `IDesignReader`, `IDesignWriter`, `ISectionTypeLister`¹, `IClock`, `IBackgroundRunner` |
| `DesignPromptBuilder` | Service — builds the provider-agnostic request | `IDesignPromptBuilder` | catalogue + rules (constructor) |
| `DesignSpecParser` | Service — extract JSON, validate, scope-merge | `IDesignSpecParser` | `IDesignValidator` (from `design`) |
| `ProposalRepository` | Repository | `IProposalRepository` | Mongoose model |
| `GeminiDesignGenerator`, `OpenRouterDesignGenerator`, `OllamaDesignGenerator`, `StubDesignGenerator` | **Adapters** | `IDesignGenerator`, `IProviderHealth` | `IHttpClient`, `Env` |
| `TimeoutDesignGenerator`, `RetryDesignGenerator` | **Decorators** | `IDesignGenerator` | an inner `IDesignGenerator`, `IClock` |
| `DesignGeneratorFactory` | **Factory** | — | `Env`; the only place the environment table is implemented |
| `InProcessBackgroundRunner` | Adapter | `IBackgroundRunner` | `ILogger` |
| `InterruptedProposalRecovery` | Startup hook | `IStartupHook` | `IInterruptedWorkRecovery` (the service's recovery role)² |
| `MonthlyGenerationAllowance` | Service — who may generate, at what charge | `IGenerationAllowance` | `IProposalRepository`, `IAiPricing`, `IGenerationWallet`, `IUserRoleReader`, `IClock` |
| `DefaultAiPricing` | Adapter — the ADR-0012 defaults until `platform-admin` | `IAiPricing` | — |
| `EmptyGenerationWallet` | Adapter — no credits until `credits-billing` | `IGenerationWallet` | — |

¹ Owned by `ai-design` and adapted in the container from the section repository (visible types),
like `IUserRoleReader` from `auth`'s user reader — so `ai-design` imports neither module's classes.
² Deviation recorded 2026-10-21 (`ai-design-studio.T04`): the table first named
`IProposalRepository`, but an interrupted proposal also gives back its charge (AC17, added by the
2026-10-21 revision), which needs the allowance; the service already holds both, so the hook
calls its `recoverInterrupted` role. A credit spend that fails after the insert removes the
pending row (`IProposalRepository.deletePending`), so nothing unpaid is left stored.
`IBackgroundRunner` is a small `core/` interface; interrupted proposals are recovered in
`buildContainer`'s startup step (`main.ts` awaits it before listening).
- Revised 2026-10-21: the daily cap became the allowance above. `IAiPricing` and
  `IGenerationWallet` are owned here; `platform-admin` and `credits-billing` implement them later
  and replace the defaults in the container (Open/Closed). Each proposal records its `charge`
  (`none` for the owner, `free`, or `credit` with the amount), so a refund knows what to return.

- **Single Responsibility split:** adapters only translate wire formats; the prompt builder knows
  nothing about providers; the parser knows nothing about transport; the service only sequences
  them. Retry-for-transport (decorator) and repair-for-validity (service) are separate concerns.
- **Composition:** `Factory.create(env)` → adapter → `RetryDesignGenerator` →
  `TimeoutDesignGenerator`, assembled in `container.ts`.
- **Structured output per provider** — confirmed against provider documentation on 2026-10-11;
  re-confirm when each adapter task starts, since these surfaces change:
  | Provider | Mechanism |
  |---|---|
  | Ollama | `POST {OLLAMA_BASE_URL}/api/chat` with `stream: false` and `format` set to the JSON Schema |
  | OpenRouter | `POST https://openrouter.ai/api/v1/chat/completions` with `response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }`. Support is per model and per upstream provider — set `require_parameters: true` in provider preferences so an unsupporting route is refused rather than silently ignored |
  | Gemini | The Interactions API, `response_format` with `mime_type: application/json` and `schema` — the only structured-output path the documentation shows (confirmed 2026-10-21, `memory/ai-provider-apis.md`) |
  The JSON Schema sent to providers is generated from the `DesignSpec` zod schema in
  `packages/design-tokens` — one definition, never hand-copied per adapter. Because providers'
  strict modes support different JSON Schema subsets, the server-side parser remains the
  authority regardless of what the provider claims to enforce.
- **Web:** `/cms/ai` — prompt form, scope select, polling hook, proposal preview through the
  shell's `PreviewPane` with the proposal's design injected, apply / discard, history, provider
  badge.
- **AI rate limit** (set 2026-10-21, `ai-design-studio.T09`; provisional): 10 API01 requests per
  10 minutes per client. Only an abuse bound — one pending proposal per portfolio and the monthly
  allowance are the real limits. Revisit with the first measured usage. Retries: one, after 1 s.

## Data Model
**`design_proposals`** — `_id`, `portfolioId`, `userId`, `status`, `prompt`, `scope`,
`basedOnCurrent`, `provider`, `model`, `design`, `rationale`, `failure`, `charge: { kind:
none | free | credit, credits, refunded }`, `durationMs`, `createdAt`, `completedAt`.
Indexes: `{ portfolioId, createdAt: -1 }` (history and the monthly count); partial unique
`{ portfolioId }` where `status = "pending"` (enforces one in flight).
No seed data. Stub fixture: `apps/api/src/modules/ai-design/providers/stub.fixture.json`.
## Constitution Check
- [x] No new datastore or queue introduced (in-process runner; no Redis)
- [x] Model output is data only — parsed, validated, contrast-checked server-side
- [x] Dev-bypass guard in exactly one place (`DesignGeneratorFactory`), tested in both directions
- [x] Model IDs, URLs and keys from `Env` only
- [x] Liskov: one contract suite across all four adapters
- [x] No PII sent to providers; prompt text and keys never logged
- [x] `design` remains the only writer of `designs` (apply goes through `IDesignWriter`)
- [x] Constrained-design scope — ADR-0006 accepted 2026-10-20
- [x] Provider selection mechanics — ADR-0003 accepted 2026-10-21
## Explicitly Deferred
- A durable job queue — needs Redis or similar, which needs an ADR; startup recovery covers the
  in-process runner's one failure mode.
- Provider fallback chains — ADR-0003 chose visible failure.
- Streaming and multi-turn refinement.
- Prompt and output evaluation harness across models — worth adding once two real providers
  have been used side by side.
## Sequencing
1. Contracts, model, repository
2. Port, stub, factory with the environment table
3. Prompt builder and parser
4. Service: create, run with repair, read, apply, discard, recovery
5. Timeout and retry decorators
6. Ollama adapter + shared contract suite
7. Gemini adapter
8. OpenRouter adapter
9. Controller, routes, AI rate limiter, container, OpenAPI
10. CMS AI screen
