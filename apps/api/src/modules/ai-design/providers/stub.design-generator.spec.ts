/**
 * `StubDesignGenerator` (`ai-design-studio.T02`; AC11): a valid design with no network. The
 * shared `IDesignGenerator` contract suite (CT01) arrives with the first network adapter (T06)
 * and runs against the stub as well.
 */
import { DEFAULT_DESIGN, validateDesign } from '@portfolio/design-tokens';
import { describe, expect, it } from 'vitest';

import type { GenerationRequest } from '../ai-design.types.js';
import { StubDesignGenerator } from './stub.design-generator.js';

const request: GenerationRequest = {
  instructions: 'Return a design.',
  messages: [{ role: 'user', content: 'Calm and editorial' }],
  schema: { type: 'object' },
  schemaName: 'design_proposal',
};

describe('StubDesignGenerator', () => {
  it('ai-design-studio.AC11 — answers with JSON text whose design passes the validator and differs from the default', async () => {
    const result = await new StubDesignGenerator().generate(request, new AbortController().signal);
    const answer = JSON.parse(result.text) as { theme: unknown; layout: unknown; rationale: unknown };
    expect(validateDesign({ theme: answer.theme, layout: answer.layout })).toMatchObject({ ok: true });
    expect(answer.theme).not.toEqual(DEFAULT_DESIGN.theme);
    expect(answer.layout).not.toEqual(DEFAULT_DESIGN.layout);
    expect(typeof answer.rationale).toBe('string');
  });

  it('refuses an aborted call with UpstreamError naming the stub', async () => {
    const controller = new AbortController();
    controller.abort(new Error('timed out'));
    await expect(new StubDesignGenerator().generate(request, controller.signal)).rejects.toMatchObject({
      status: 502,
      code: 'UPSTREAM_FAILED',
      details: { provider: 'stub' },
    });
  });

  it('is always reachable', async () => {
    await expect(new StubDesignGenerator().check()).resolves.toEqual({ reachable: true });
  });
});
