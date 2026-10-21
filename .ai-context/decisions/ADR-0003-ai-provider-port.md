# ADR-0003: One design-generation port; provider chosen by configuration
**Status:** Accepted — provider list (owner, 2026-10-11); selection mechanics as written (owner,
2026-10-21: `AI_PROVIDER` / `AI_MODEL`, the stub outside production only, production refusal,
timeout and retry decorators, no automatic fallback)

## Context
The owner named three providers: Gemini or OpenRouter for UI design generation, and Ollama
models for local development. Each has a different wire format, auth and structured-output
mechanism. Services must not know which one is in use (Dependency Inversion).

## Decision
A single port `IDesignGenerator`, with adapters `GeminiDesignGenerator`,
`OpenRouterDesignGenerator`, `OllamaDesignGenerator` and `StubDesignGenerator`.
`DesignGeneratorFactory` selects one from `AI_PROVIDER`; the model ID comes from `AI_MODEL`.
Timeout and retry are decorators around whichever adapter is chosen. Prompt construction and
output parsing are provider-agnostic classes outside the adapters. Every adapter passes one
shared contract suite.

Environment rules: outside production, an unset `AI_PROVIDER` yields the stub. In production,
startup fails when `AI_PROVIDER` is unset, `stub` or `ollama`, or when the chosen provider's
credential is missing.

## Consequences
- Switching provider or model is an environment change.
- Adding a provider is one new adapter class and one factory registration.
- Rejecting Ollama in production follows the owner's "for local development" wording; running a
  self-hosted Ollama in production would need this ADR superseded.
- No automatic fallback between providers. A failed generation fails visibly.
- Provider wire details (structured-output parameters, endpoints) must be confirmed against
  each provider's current documentation at implementation time; none is fixed by this ADR.
