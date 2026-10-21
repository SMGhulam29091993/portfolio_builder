# Tasks: AI Design Studio
## Derived From
.ai-context/plans/ai-design-studio.plan.md
## Sequence
- [x] ai-design-studio.T01 — `packages/contracts/src/ai-design` (proposal, request/response schemas); `design_proposals` model with indexes incl. the partial unique index; `ProposalRepository` — Acceptance: AC1, AC7
- [ ] ai-design-studio.T02 — `IDesignGenerator`, `IProviderHealth`, `StubDesignGenerator` + fixture, `DesignGeneratorFactory` implementing the environment table, production startup validation (the factory, at container build) — Acceptance: AC11, AC12
- [ ] ai-design-studio.T03 — `DesignPromptBuilder` (no PII; catalogue, rules, scope) and `DesignSpecParser` (JSON extraction, validation through `IDesignValidator`, markup / URL rejection, scope merge); JSON Schema derived from the `DesignSpec` zod schema — Acceptance: AC3, AC4, AC5, AC15
- [ ] ai-design-studio.T04 — `MonthlyGenerationAllowance`, `DefaultAiPricing`, `EmptyGenerationWallet`; `AiDesignService` with `IBackgroundRunner`: create (one pending, the allowance and its charge), run with one repair attempt, get / list, apply through `IDesignWriter`, discard; `InterruptedProposalRecovery` startup hook (`IStartupHook` in `core/`); `ISectionTypeLister` exported from `portfolio` — Acceptance: AC1, AC2, AC3, AC4, AC7, AC8, AC9, AC10
- [ ] ai-design-studio.T05 — `TimeoutDesignGenerator` and `RetryDesignGenerator` with an injected clock — Acceptance: AC6
- [ ] ai-design-studio.T06 — `OllamaDesignGenerator`; the shared `IDesignGenerator` contract suite with recorded responses; run it against stub + Ollama — Acceptance: AC13, AC14
- [ ] ai-design-studio.T07 — `GeminiDesignGenerator` on the Interactions API (confirmed 2026-10-21, `memory/ai-provider-apis.md`); add to the contract suite — Acceptance: AC13, AC14
- [ ] ai-design-studio.T08 — `OpenRouterDesignGenerator` with `require_parameters`; add to the contract suite — Acceptance: AC13, AC14
- [ ] ai-design-studio.T09 — `AiDesignController`, routes, AI rate limiter, container wiring (factory → retry → timeout), OpenAPI for API01–API06 — Acceptance: AC1, AC7
- [ ] ai-design-studio.T10 — `/cms/ai` screen: prompt + scope, polling, proposal preview at both widths, apply / discard, failure messages, history, provider badge, the allowance and credit cost — Acceptance: AC16, AC18
