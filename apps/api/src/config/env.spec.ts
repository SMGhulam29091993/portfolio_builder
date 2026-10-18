import { describe, expect, it } from 'vitest';

import { EnvValidationError, loadEnv } from './env.js';

/** A complete, valid environment. The URIs carry a fake credential to prove it never leaks. */
const VALID_SOURCE = {
  NODE_ENV: 'test',
  PORT: '4100',
  MONGODB_URI: 'mongodb://svc-user:not-a-real-secret@db.internal:27017/portfolio',
  REDIS_URL: 'redis://svc-user:not-a-real-secret@cache.internal:6379/0',
  JWT_ACCESS_SECRET: 'not-a-real-secret-but-32-chars-long-0000',
  WEB_ORIGIN: 'https://portfolio.example',
} as const;

const REQUIRED_VARIABLES = [
  'PORT',
  'MONGODB_URI',
  'REDIS_URL',
  'JWT_ACCESS_SECRET',
  'WEB_ORIGIN',
] as const;

/** Runs `loadEnv` and returns the `EnvValidationError` it throws, failing the test otherwise. */
function captureEnvError(source: Record<string, string | undefined>): EnvValidationError {
  try {
    loadEnv(source);
  } catch (error) {
    if (error instanceof EnvValidationError) return error;
    throw error;
  }
  throw new Error('expected loadEnv to throw');
}

describe('loadEnv', () => {
  it('monorepo-foundation.UT01 — names a missing MONGODB_URI without echoing any value', () => {
    const error = captureEnvError({ ...VALID_SOURCE, MONGODB_URI: undefined });

    expect(error.variables).toEqual(['MONGODB_URI']);
    expect(error.message).toContain('MONGODB_URI');
    expect(error.message).not.toContain(VALID_SOURCE.PORT);
    expect(error.message).not.toContain('not-a-real-secret');
  });

  it('monorepo-foundation.UT02 — returns a frozen, typed object for a valid environment', () => {
    const env = loadEnv(VALID_SOURCE);

    expect(env).toEqual({
      NODE_ENV: 'test',
      PORT: 4100,
      MONGODB_URI: VALID_SOURCE.MONGODB_URI,
      REDIS_URL: VALID_SOURCE.REDIS_URL,
      JWT_ACCESS_SECRET: VALID_SOURCE.JWT_ACCESS_SECRET,
      WEB_ORIGIN: VALID_SOURCE.WEB_ORIGIN,
    });
    expect(Object.isFrozen(env)).toBe(true);
  });

  it.each(REQUIRED_VARIABLES)('names %s when it is removed (data variation)', (name) => {
    const error = captureEnvError({ ...VALID_SOURCE, [name]: undefined });

    expect(error.variables).toEqual([name]);
  });

  it('rejects a non-numeric PORT (data variation)', () => {
    const error = captureEnvError({ ...VALID_SOURCE, PORT: 'eighty' });

    expect(error.variables).toEqual(['PORT']);
    expect(error.message).not.toContain('eighty');
  });

  it('rejects a MONGODB_URI with an invalid scheme without echoing it (data variation)', () => {
    const error = captureEnvError({
      ...VALID_SOURCE,
      MONGODB_URI: 'postgres://svc-user:not-a-real-secret@db.internal/portfolio',
    });

    expect(error.variables).toEqual(['MONGODB_URI']);
    expect(error.message).not.toContain('not-a-real-secret');
  });

  it('reports every invalid variable at once', () => {
    const error = captureEnvError({ NODE_ENV: 'staging' });

    expect(error.variables).toEqual([
      'NODE_ENV',
      'PORT',
      'MONGODB_URI',
      'REDIS_URL',
      'JWT_ACCESS_SECRET',
      'WEB_ORIGIN',
    ]);
  });

  it.each([
    ['a path', 'https://portfolio.example/cms'],
    ['a trailing slash', 'https://portfolio.example/'],
    ['a query', 'https://portfolio.example?x=1'],
    ['a non-http scheme', 'ftp://portfolio.example'],
    ['no scheme', 'portfolio.example'],
    ['upper case (browsers send it lower-cased)', 'https://Portfolio.example'],
    ['a default port spelled out (browsers omit it)', 'https://portfolio.example:443'],
  ])('owner-auth.T06 — rejects a WEB_ORIGIN with %s (data variation)', (_case, value) => {
    const error = captureEnvError({ ...VALID_SOURCE, WEB_ORIGIN: value });

    expect(error.variables).toEqual(['WEB_ORIGIN']);
  });

  it.each(['http://localhost:3000', 'http://127.0.0.1:3100', 'https://portfolio.example'])(
    'owner-auth.T06 — accepts the bare origin %s',
    (value) => {
      expect(loadEnv({ ...VALID_SOURCE, WEB_ORIGIN: value }).WEB_ORIGIN).toBe(value);
    },
  );

  it('owner-auth.T05 — rejects a JWT_ACCESS_SECRET shorter than 32 characters without echoing it', () => {
    const error = captureEnvError({ ...VALID_SOURCE, JWT_ACCESS_SECRET: 'short-secret-value' });

    expect(error.variables).toEqual(['JWT_ACCESS_SECRET']);
    expect(error.message).not.toContain('short-secret-value');
  });

  it('owner-auth.T01 — rejects a REDIS_URL with an invalid scheme without echoing it (data variation)', () => {
    const error = captureEnvError({
      ...VALID_SOURCE,
      REDIS_URL: 'http://svc-user:not-a-real-secret@cache.internal:6379',
    });

    expect(error.variables).toEqual(['REDIS_URL']);
    expect(error.message).not.toContain('not-a-real-secret');
  });

  it('owner-auth.T01 — accepts a TLS REDIS_URL (rediss://)', () => {
    const env = loadEnv({ ...VALID_SOURCE, REDIS_URL: 'rediss://cache.internal:6380' });

    expect(env.REDIS_URL).toBe('rediss://cache.internal:6380');
  });

  it('defaults NODE_ENV to development when it is unset', () => {
    const env = loadEnv({ ...VALID_SOURCE, NODE_ENV: undefined });

    expect(env.NODE_ENV).toBe('development');
  });
});
