import { describe, expect, it } from 'vitest';

import {
  AppError,
  ConflictError,
  NotFoundError,
  PayloadTooLargeError,
  RateLimitedError,
  ServiceUnavailableError,
  UnauthenticatedError,
  UnsupportedMediaTypeError,
  UpstreamError,
  ValidationError,
} from './index.js';

/** Each subclass against its row of the canonical error-code table. */
const CANONICAL_ROWS: readonly [AppError, number, string, Record<string, unknown>][] = [
  [
    new ValidationError([{ path: 'title', message: 'Required' }]),
    400,
    'VALIDATION_FAILED',
    { errors: [{ path: 'title', message: 'Required' }] },
  ],
  [new UnauthenticatedError(), 401, 'UNAUTHENTICATED', {}],
  [new NotFoundError(), 404, 'NOT_FOUND', {}],
  [
    new ConflictError('REVISION_CONFLICT', { currentRevision: 7 }),
    409,
    'REVISION_CONFLICT',
    { currentRevision: 7 },
  ],
  [new PayloadTooLargeError(1024), 413, 'PAYLOAD_TOO_LARGE', { maxBytes: 1024 }],
  [
    new UnsupportedMediaTypeError(['image/png']),
    415,
    'UNSUPPORTED_MEDIA_TYPE',
    { allowed: ['image/png'] },
  ],
  [new RateLimitedError(30), 429, 'RATE_LIMITED', { retryAfterSec: 30 }],
  [new UpstreamError('gemini'), 502, 'UPSTREAM_FAILED', { provider: 'gemini' }],
  [new ServiceUnavailableError({ db: 'down' }), 503, 'SERVICE_UNAVAILABLE', { db: 'down' }],
];

describe('AppError subclasses', () => {
  it.each(CANONICAL_ROWS)('%s maps to %i %s', (error, status, code, details) => {
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(status);
    expect(error.code).toBe(code);
    expect(error.details).toEqual(details);
  });

  it('names each error after its class', () => {
    expect(new NotFoundError().name).toBe('NotFoundError');
  });

  it('sets Retry-After on RateLimitedError', () => {
    expect(new RateLimitedError(30).headers).toEqual({ 'Retry-After': '30' });
  });

  it('keeps the provider error as cause on UpstreamError without exposing it in details', () => {
    const providerError = new Error('quota exceeded for key sk-123');
    const error = new UpstreamError('openrouter', { cause: providerError });

    expect(error.cause).toBe(providerError);
    expect(JSON.stringify(error.details)).not.toContain('sk-123');
  });
});
