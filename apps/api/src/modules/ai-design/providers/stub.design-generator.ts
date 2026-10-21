/**
 * `StubDesignGenerator` — the dev-bypass guard's answer (`constitution.md` → Security Posture;
 * `ai-design-studio.AC11`). It returns a fixed, valid design from `stub.fixture.json` with no
 * network, so the create → ready → apply flow works on a machine with no provider. It is chosen
 * only by `DesignGeneratorFactory`, and never in production.
 */
import { UpstreamError } from '../../../core/errors/index.js';
import type { IDesignGenerator, IProviderHealth } from '../ai-design.interface.js';
import type { GenerationRequest, GenerationResult } from '../ai-design.types.js';
import fixture from './stub.fixture.json' with { type: 'json' };

/** The model name proposals record for the stub; not a provider's model id. */
export const STUB_MODEL = 'fixture';

export class StubDesignGenerator implements IDesignGenerator, IProviderHealth {
  readonly providerId = 'stub';

  /** The text a provider would return: the fixture as one JSON object. */
  private readonly answer = JSON.stringify(fixture);

  generate(_request: GenerationRequest, signal: AbortSignal): Promise<GenerationResult> {
    // Honours the signal like a network adapter would (AC13): an aborted call does not answer.
    if (signal.aborted) return Promise.reject(new UpstreamError(this.providerId, { cause: signal.reason }));
    return Promise.resolve({ text: this.answer });
  }

  check(): Promise<{ reachable: boolean }> {
    return Promise.resolve({ reachable: true });
  }
}
