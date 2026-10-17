import { describe, expect, it } from 'vitest';

import { loadEnv, WebEnvValidationError } from './env';

/** A credential that must never be copied into an error. */
const FAKE_SECRET = 'not-a-real-secret';

describe('loadEnv', () => {
  it('monorepo-foundation.UT08 — returns a frozen env when every variable is valid', () => {
    const env = loadEnv({ API_INTERNAL_URL: 'http://127.0.0.1:4000' });

    expect(env).toEqual({ API_INTERNAL_URL: 'http://127.0.0.1:4000' });
    expect(Object.isFrozen(env)).toBe(true);
  });

  it('monorepo-foundation.UT08 — names a missing variable', () => {
    expect(() => loadEnv({})).toThrow(
      expect.objectContaining({
        name: 'WebEnvValidationError',
        variables: ['API_INTERNAL_URL'],
      }) as Error,
    );
  });

  it.each([
    ['not a URL', 'api.internal:4000'],
    ['a non-HTTP scheme', 'ftp://api.internal'],
  ])('monorepo-foundation.UT08 — rejects %s', (_label, value) => {
    expect(() => loadEnv({ API_INTERNAL_URL: value })).toThrow(WebEnvValidationError);
  });

  it('monorepo-foundation.UT08 — never echoes a rejected value, which may carry credentials', () => {
    const caught = captureError(() =>
      loadEnv({ API_INTERNAL_URL: `ftp://svc:${FAKE_SECRET}@api.internal` }),
    );

    expect(caught).toBeInstanceOf(WebEnvValidationError);
    expect(JSON.stringify(caught)).not.toContain(FAKE_SECRET);
    expect((caught as Error).message).not.toContain(FAKE_SECRET);
  });
});

function captureError(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error('expected the call to throw');
}
