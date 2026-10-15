/**
 * The rate limiter over real HTTP, in front of the real error middleware, with a controllable
 * clock so tests can step into the next window without waiting.
 */
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import type { ILogger } from '../logger/logger.interface.js';
import { createErrorHandler } from './error-handler.js';
import { RateLimiterFactory, type RateLimitPolicy } from './rate-limiter-factory.js';
import { ok } from './respond.js';

const silentLogger: ILogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

/** A clock the test advances by hand. */
class ManualClock {
  private current = 1_000_000;
  readonly now = (): number => this.current;
  advance(ms: number): void {
    this.current += ms;
  }
}

/** Mounts a limiter on `GET /api/v1/health` the way the health module will. */
function appWith(limiter: RequestHandler): express.Express {
  const app = express();
  app.get('/api/v1/health', limiter, (_req, res) => {
    ok(res, 'ok');
  });
  app.use(createErrorHandler(silentLogger));
  return app;
}

/** Builds a limiter whose client key comes from a test header, to simulate distinct clients. */
function limiterFor(clock: ManualClock, policy: Omit<RateLimitPolicy, 'keyOf'>): RequestHandler {
  return new RateLimiterFactory(clock.now).create({
    ...policy,
    keyOf: (req) => req.get('X-Test-Client') ?? 'anonymous',
  });
}

describe('RateLimiterFactory', () => {
  it('monorepo-foundation.IT06 — answers 429 with Retry-After once the limit is exceeded, then recovers next window', async () => {
    const clock = new ManualClock();
    const app = appWith(limiterFor(clock, { windowMs: 60_000, max: 2 }));

    await request(app).get('/api/v1/health').expect(200);
    clock.advance(15_000);
    await request(app).get('/api/v1/health').expect(200);

    const limited = await request(app).get('/api/v1/health');

    expect(limited.status).toBe(429);
    // 45 s of the 60 s window remain.
    expect(limited.headers['retry-after']).toBe('45');
    expect(limited.body).toEqual({
      success: false,
      message: 'Too many requests',
      data: { code: 'RATE_LIMITED', retryAfterSec: 45 },
    });

    clock.advance(45_000);
    await request(app).get('/api/v1/health').expect(200);
  });

  it('counts each client separately', async () => {
    const clock = new ManualClock();
    const app = appWith(limiterFor(clock, { windowMs: 60_000, max: 1 }));

    await request(app).get('/api/v1/health').set('X-Test-Client', 'a').expect(200);
    await request(app).get('/api/v1/health').set('X-Test-Client', 'a').expect(429);
    await request(app).get('/api/v1/health').set('X-Test-Client', 'b').expect(200);
  });

  it('gives each limiter its own counters', async () => {
    const clock = new ManualClock();
    const factory = new RateLimiterFactory(clock.now);
    const app = express();
    app.get('/a', factory.create({ windowMs: 60_000, max: 1 }), (_req, res) => res.end());
    app.get('/b', factory.create({ windowMs: 60_000, max: 1 }), (_req, res) => res.end());
    app.use(createErrorHandler(silentLogger));

    await request(app).get('/a').expect(200);
    await request(app).get('/b').expect(200);
    await request(app).get('/a').expect(429);
  });

  it('keys on the client IP by default', async () => {
    const clock = new ManualClock();
    const app = appWith(new RateLimiterFactory(clock.now).create({ windowMs: 1_000, max: 1 }));

    await request(app).get('/api/v1/health').expect(200);
    await request(app).get('/api/v1/health').expect(429);
  });

  it.each([
    { windowMs: 0, max: 1 },
    { windowMs: 1_000, max: 0 },
    { windowMs: 1.5, max: 1 },
  ])('rejects an invalid policy %o', (policy) => {
    expect(() => new RateLimiterFactory().create(policy)).toThrow(RangeError);
  });
});
