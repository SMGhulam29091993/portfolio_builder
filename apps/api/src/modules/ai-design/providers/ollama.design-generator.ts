/**
 * `OllamaDesignGenerator` (`ai-design-studio.T06`; AC13, AC14) — a local Ollama server, for
 * development only (ADR-0003; production refuses it in `DesignGeneratorFactory`). Wire format
 * confirmed 2026-10-21 (`memory/ai-provider-apis.md`):
 * `POST {OLLAMA_BASE_URL}/api/chat` with `{ model, messages, stream: false, format: <schema> }`;
 * the text is `message.content`. Health is `GET /api/tags`.
 */
import { UpstreamError } from '../../../core/errors/index.js';
import type { IDesignGenerator, IHttpClient, IProviderHealth } from '../ai-design.interface.js';
import type { GenerationRequest, GenerationResult } from '../ai-design.types.js';

export interface OllamaSettings {
  readonly baseUrl: string;
  readonly model: string;
  /** Upper bound on the health probe. */
  readonly probeTimeoutMs: number;
}

export class OllamaDesignGenerator implements IDesignGenerator, IProviderHealth {
  readonly providerId = 'ollama';

  constructor(
    private readonly settings: OllamaSettings,
    private readonly http: IHttpClient,
  ) {}

  async generate(request: GenerationRequest, signal: AbortSignal): Promise<GenerationResult> {
    const answer = await this.http.postJson(
      this.providerId,
      this.endpoint('api/chat'),
      {},
      {
        model: this.settings.model,
        messages: [{ role: 'system', content: request.instructions }, ...request.messages],
        stream: false,
        format: request.schema,
      },
      signal,
    );
    const text = (answer as { message?: { content?: unknown } } | null)?.message?.content;
    if (typeof text !== 'string') throw new UpstreamError(this.providerId, { cause: new Error('No message content') });
    return { text };
  }

  check(): Promise<{ reachable: boolean }> {
    return this.http.probe(this.endpoint('api/tags'), {}, this.settings.probeTimeoutMs).then((reachable) => ({ reachable }));
  }

  /** `path` under the base URL, keeping any path the base already has. */
  private endpoint(path: string): string {
    const base = this.settings.baseUrl.endsWith('/') ? this.settings.baseUrl : `${this.settings.baseUrl}/`;
    return new URL(path, base).toString();
  }
}
