/**
 * `OpenRouterDesignGenerator` (`ai-design-studio.T08`; AC13, AC14). Wire format confirmed
 * 2026-10-21 (`memory/ai-provider-apis.md`): `POST {OPENROUTER_BASE_URL}/chat/completions` with
 * `Authorization: Bearer <key>` (never in the URL), body `{ model, messages, response_format:
 * { type: "json_schema", json_schema: { name, strict: true, schema } }, provider:
 * { require_parameters: true } }`. Structured output is supported per model and per upstream
 * provider, so `require_parameters` makes OpenRouter refuse a route that would silently ignore
 * the schema. The text is `choices[0].message.content`. Health is `GET {base}/models`.
 *
 * `max_tokens` is sent when `AI_MAX_OUTPUT_TOKENS` is set: without it OpenRouter reserves the
 * model's whole output limit against the account's credits, and a small balance answers 402.
 */
import { UpstreamError } from '../../../core/errors/index.js';
import type { IDesignGenerator, IHttpClient, IProviderHealth } from '../ai-design.interface.js';
import type { GenerationRequest, GenerationResult } from '../ai-design.types.js';

export interface OpenRouterSettings {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
  /** `AI_MAX_OUTPUT_TOKENS`; unset sends no `max_tokens`. */
  readonly maxOutputTokens?: number | undefined;
  readonly probeTimeoutMs: number;
}

export class OpenRouterDesignGenerator implements IDesignGenerator, IProviderHealth {
  readonly providerId = 'openrouter';

  constructor(
    private readonly settings: OpenRouterSettings,
    private readonly http: IHttpClient,
  ) {}

  async generate(request: GenerationRequest, signal: AbortSignal): Promise<GenerationResult> {
    const answer = await this.http.postJson(
      this.providerId,
      this.endpoint('chat/completions'),
      this.headers(),
      {
        model: this.settings.model,
        messages: [{ role: 'system', content: request.instructions }, ...request.messages],
        response_format: {
          type: 'json_schema',
          json_schema: { name: request.schemaName, strict: true, schema: request.schema },
        },
        provider: { require_parameters: true },
        ...(this.settings.maxOutputTokens === undefined ? {} : { max_tokens: this.settings.maxOutputTokens }),
      },
      signal,
    );
    const choices = (answer as { choices?: unknown } | null)?.choices;
    const text = Array.isArray(choices)
      ? (choices[0] as { message?: { content?: unknown } } | undefined)?.message?.content
      : undefined;
    if (typeof text !== 'string') throw new UpstreamError(this.providerId, { cause: new Error('No message content') });
    return { text };
  }

  check(): Promise<{ reachable: boolean }> {
    return this.http.probe(this.endpoint('models'), this.headers(), this.settings.probeTimeoutMs).then((reachable) => ({ reachable }));
  }

  private headers(): Readonly<Record<string, string>> {
    return { authorization: `Bearer ${this.settings.apiKey}` };
  }

  private endpoint(path: string): string {
    const base = this.settings.baseUrl.endsWith('/') ? this.settings.baseUrl : `${this.settings.baseUrl}/`;
    return new URL(path, base).toString();
  }
}
