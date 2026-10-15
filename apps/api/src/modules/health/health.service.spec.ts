/**
 * Service-layer tests: `IDatabaseProbe` is a constructor-injected fake and no datastore is
 * touched (`constitution.md` → Per-layer convention).
 */
import { describe, expect, it } from 'vitest';

import { ServiceUnavailableError } from '../../core/errors/index.js';
import type { IDatabaseProbe } from './health.interface.js';
import { HealthService } from './health.service.js';

/** Probe whose answer the test controls. */
class FakeProbe implements IDatabaseProbe {
  constructor(private readonly behaviour: 'up' | 'down' | 'hang') {}

  ping(): Promise<void> {
    if (this.behaviour === 'up') return Promise.resolve();
    if (this.behaviour === 'down') return Promise.reject(new Error('connection refused'));
    return new Promise<void>(() => undefined);
  }
}

function serviceWith(probe: IDatabaseProbe, pingTimeoutMs = 1_000): HealthService {
  return new HealthService(probe, { version: '1.2.3', pingTimeoutMs, uptimeSec: () => 42 });
}

describe('HealthService', () => {
  it('monorepo-foundation.UT07 — reports db up with the runtime facts', async () => {
    await expect(serviceWith(new FakeProbe('up')).check()).resolves.toEqual({
      status: 'ok',
      db: 'up',
      version: '1.2.3',
      uptimeSec: 42,
    });
  });

  it('monorepo-foundation.UT07 — throws SERVICE_UNAVAILABLE with db down when the ping fails', async () => {
    const result = serviceWith(new FakeProbe('down')).check();

    await expect(result).rejects.toBeInstanceOf(ServiceUnavailableError);
    await expect(result).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      details: { db: 'down' },
      cause: expect.objectContaining({ message: 'connection refused' }) as unknown,
    });
  });

  it('throws SERVICE_UNAVAILABLE once the ping exceeds its timeout', async () => {
    const started = Date.now();

    await expect(serviceWith(new FakeProbe('hang'), 50).check()).rejects.toMatchObject({
      details: { db: 'down' },
    });
    expect(Date.now() - started).toBeLessThan(1_000);
  });
});
