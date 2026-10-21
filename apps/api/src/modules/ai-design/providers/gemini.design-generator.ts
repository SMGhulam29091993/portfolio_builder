/**
 * `GeminiDesignGenerator` (`ai-design-studio.T07`; AC13, AC14) — Gemini through the Interactions
 * API, the only structured-output path its documentation shows. Wire format confirmed
 * 2026-10-21 (`memory/ai-provider-apis.md`):
 * `POST {GEMINI_BASE_URL}/interactions`, key in `x-goog-api-key` (never in the URL), body
 * `{ model, system_instruction, input: [steps], response_format: { type: "text", mime_type:
 * "application/json", schema } }`; the text is the `model_output` step's `text` content. Health
 * is `GET {GEMINI_BASE_URL}/models`.
 */
import { UpstreamError } from '../../../core/errors/index.js';
import type { IDesignGenerator, IHttpClient, IProviderHealth } from '../ai-design.interface.js';
import type { GenerationRequest, GenerationResult } from '../ai-design.types.js';

export interface GeminiSettings {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
  readonly probeTimeoutMs: number;
}

interface InteractionStep {
  readonly type?: unknown;
  readonly content?: readonly { readonly type?: unknown; readonly text?: unknown }[];
}

export class GeminiDesignGenerator implements IDesignGenerator, IProviderHealth {
  readonly providerId = 'gemini';

  constructor(
    private readonly settings: GeminiSettings,
    private readonly http: IHttpClient,
  ) {}

  async generate(request: GenerationRequest, signal: AbortSignal): Promise<GenerationResult> {
    const answer = await this.http.postJson(
      this.providerId,
      this.endpoint('interactions'),
      this.headers(),
      {
        model: this.settings.model,
        system_instruction: request.instructions,
        input: request.messages.map((message) => ({
          type: message.role === 'user' ? 'user_input' : 'model_output',
          content: [{ type: 'text', text: message.content }],
        })),
        response_format: { type: 'text', mime_type: 'application/json', schema: request.schema },
      },
      signal,
    );
    const steps = (answer as { steps?: unknown } | null)?.steps;
    const output = Array.isArray(steps)
      ? (steps as InteractionStep[]).findLast((step) => step.type === 'model_output')
      : undefined;
    const parts = output?.content?.filter((part) => part.type === 'text' && typeof part.text === 'string') ?? [];
    if (parts.length === 0) throw new UpstreamError(this.providerId, { cause: new Error('No model output text') });
    return { text: parts.map((part) => part.text as string).join('') };
  }

  check(): Promise<{ reachable: boolean }> {
    return this.http.probe(this.endpoint('models'), this.headers(), this.settings.probeTimeoutMs).then((reachable) => ({ reachable }));
  }

  private headers(): Readonly<Record<string, string>> {
    return { 'x-goog-api-key': this.settings.apiKey };
  }

  private endpoint(path: string): string {
    const base = this.settings.baseUrl.endsWith('/') ? this.settings.baseUrl : `${this.settings.baseUrl}/`;
    return new URL(path, base).toString();
  }
}
