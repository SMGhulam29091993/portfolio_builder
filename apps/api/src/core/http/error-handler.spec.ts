/**
 * The error middleware, `notFound` and the JSON body limits, exercised over real HTTP with the
 * same middleware order the app factory will use: JSON body → routes → `notFound` → errors.
 */
import express, { type Router } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { ConflictError, RateLimitedError, UpstreamError } from '../errors/index.js';
import type { ILogger, LogContext } from '../logger/logger.interface.js';
import { createErrorHandler } from './error-handler.js';
import { createJsonBodyParser } from './json-body.js';
import { notFound } from './not-found.js';
import { ok } from './respond.js';

interface LoggedEntry {
  readonly level: string;
  readonly message: string;
  readonly context: LogContext;
}

/** Logger that keeps every entry for assertions. */
class CapturingLogger implements ILogger {
  readonly entries: LoggedEntry[] = [];
  debug(message: string, context: LogContext = {}): void {
    this.entries.push({ level: 'debug', message, context });
  }
  info(message: string, context: LogContext = {}): void {
    this.entries.push({ level: 'info', message, context });
  }
  warn(message: string, context: LogContext = {}): void {
    this.entries.push({ level: 'warn', message, context });
  }
  error(message: string, context: LogContext = {}): void {
    this.entries.push({ level: 'error', message, context });
  }
}

/** A tiny JSON limit so the oversized-body case needs only a short payload. */
const TEST_BODY_LIMIT_BYTES = 64;

/** Builds an app with `routes` mounted under `/api/v1`, a request id, and the error chain. */
function buildApp(routes: Router, logger: ILogger = new CapturingLogger()): express.Express {
  const app = express();
  app.use((req, _res, next) => {
    // Stand-in for the request-id middleware that `monorepo-foundation.T05` adds.
    req.requestId = 'req-test-1';
    next();
  });
  app.use(createJsonBodyParser(TEST_BODY_LIMIT_BYTES));
  app.use('/api/v1', routes, notFound);
  app.use(createErrorHandler(logger));
  return app;
}

function testRoutes(): Router {
  const router = express.Router();
  router.get('/boom', () => {
    throw new Error('boom: connection to db.internal refused');
  });
  router.get('/boom-async', async () => {
    await Promise.resolve();
    throw new Error('async boom');
  });
  router.get('/conflict', () => {
    throw new ConflictError('REVISION_CONFLICT', { currentRevision: 4 });
  });
  router.get('/limited', () => {
    throw new RateLimitedError(12);
  });
  router.get('/upstream', () => {
    throw new UpstreamError('gemini', { cause: new Error('quota exceeded') });
  });
  router.post('/echo', (req, res) => {
    ok(res, 'echoed', req.body);
  });
  return router;
}

describe('notFound', () => {
  it('monorepo-foundation.IT04 — answers an unmatched /api/v1 path with 404 NOT_FOUND', async () => {
    const response = await request(buildApp(testRoutes())).get('/api/v1/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: 'Route not found',
      data: { code: 'NOT_FOUND' },
    });
  });
});

describe('createErrorHandler', () => {
  it('monorepo-foundation.UT03 / IT05 — maps a plain Error to 500 INTERNAL_ERROR with no detail', async () => {
    const logger = new CapturingLogger();

    const response = await request(buildApp(testRoutes(), logger)).get('/api/v1/boom');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      message: 'Internal server error',
      data: { code: 'INTERNAL_ERROR' },
    });
    expect(response.text).not.toContain('boom');
    expect(response.text).not.toContain('stack');
  });

  it('monorepo-foundation.AC7 — logs the original error with the request id', async () => {
    const logger = new CapturingLogger();

    await request(buildApp(testRoutes(), logger)).get('/api/v1/boom?token=abc');

    expect(logger.entries).toHaveLength(1);
    const [entry] = logger.entries;
    expect(entry?.level).toBe('error');
    expect(entry?.context).toEqual(
      expect.objectContaining({ requestId: 'req-test-1', method: 'GET', path: '/api/v1/boom' }),
    );
    expect((entry?.context.error as Error).message).toContain('boom');
    // The query string can carry tokens, so it is not logged.
    expect(JSON.stringify(entry?.context)).not.toContain('token=abc');
  });

  it('reaches the error middleware from a rejected async handler (Express 5)', async () => {
    const response = await request(buildApp(testRoutes())).get('/api/v1/boom-async');

    expect(response.status).toBe(500);
    expect(response.text).not.toContain('async boom');
  });

  it('monorepo-foundation.UT04 — maps ConflictError(REVISION_CONFLICT) to 409 with its details', async () => {
    const logger = new CapturingLogger();

    const response = await request(buildApp(testRoutes(), logger)).get('/api/v1/conflict');

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      success: false,
      message: 'Request conflicts with the current state',
      data: { code: 'REVISION_CONFLICT', currentRevision: 4 },
    });
    // An expected 4xx is not an operational failure and is not logged.
    expect(logger.entries).toHaveLength(0);
  });

  it('sets the headers an AppError requires (Retry-After on 429)', async () => {
    const response = await request(buildApp(testRoutes())).get('/api/v1/limited');

    expect(response.status).toBe(429);
    expect(response.headers['retry-after']).toBe('12');
    expect(response.body).toEqual(
      expect.objectContaining({ data: { code: 'RATE_LIMITED', retryAfterSec: 12 } }),
    );
  });

  it('logs a 5xx AppError with its cause but sends only the provider name', async () => {
    const logger = new CapturingLogger();

    const response = await request(buildApp(testRoutes(), logger)).get('/api/v1/upstream');

    expect(response.status).toBe(502);
    expect(response.body).toEqual(
      expect.objectContaining({ data: { code: 'UPSTREAM_FAILED', provider: 'gemini' } }),
    );
    expect(response.text).not.toContain('quota');
    expect(logger.entries).toEqual([
      expect.objectContaining({ level: 'error', message: 'request failed' }),
    ]);
  });
});

describe('JSON body handling', () => {
  it('monorepo-foundation.IT08 — answers malformed JSON with 400 VALIDATION_FAILED, not 500', async () => {
    const response = await request(buildApp(testRoutes()))
      .post('/api/v1/echo')
      .set('Content-Type', 'application/json')
      .send('{"title": ');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: 'Request validation failed',
      data: { code: 'VALIDATION_FAILED', errors: [{ path: '', message: 'Malformed JSON body' }] },
    });
  });

  it('monorepo-foundation.IT09 — answers a body above the limit with 413 PAYLOAD_TOO_LARGE', async () => {
    const response = await request(buildApp(testRoutes()))
      .post('/api/v1/echo')
      .send({ text: 'x'.repeat(TEST_BODY_LIMIT_BYTES) });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({
      success: false,
      message: 'Request body is too large',
      data: { code: 'PAYLOAD_TOO_LARGE', maxBytes: TEST_BODY_LIMIT_BYTES },
    });
  });

  it('accepts a body within the limit and answers in the success envelope', async () => {
    const response = await request(buildApp(testRoutes())).post('/api/v1/echo').send({ a: 1 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, message: 'echoed', data: { a: 1 } });
  });
});
