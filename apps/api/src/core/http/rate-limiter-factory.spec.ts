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

  describe('counting only some responses (`counts`)', () => {
    /** An app whose handler answers the status named by the `X-Test-Status` header. */
    function appCounting(clock: ManualClock, counts: (status: number) => boolean): express.Express {
      const app = express();
      app.post(
        '/attempt',
        new RateLimiterFactory(clock.now).create({ windowMs: 60_000, max: 2, counts }),
        (req, res) => {
          res.status(Number(req.get('X-Test-Status') ?? '200')).end();
        },
      );
      app.use(createErrorHandler(silentLogger));
      return app;
    }

    const onlyUnauthorized = (status: number): boolean => status === 401;

    it('owner-auth.T06 — gives back the slot of a response that does not count', async () => {
      const app = appCounting(new ManualClock(), onlyUnauthorized);

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await request(app).post('/attempt').set('X-Test-Status', '200').expect(200);
      }
      await request(app).post('/attempt').set('X-Test-Status', '401').expect(401);
      await request(app).post('/attempt').set('X-Test-Status', '401').expect(401);

      const limited = await request(app).post('/attempt').set('X-Test-Status', '200');
      expect(limited.status).toBe(429);
      expect(limited.headers['retry-after']).toBe('60');
    });

    it('owner-auth.T06 — holds the slot while a request is in flight, so parallel attempts cannot overshoot', async () => {
      // The handler parks every request until the test releases them, so two are in flight
      // together; neither has a status yet, so neither can have been given back.
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      let arrived = 0;
      const app = express();
      app.post(
        '/attempt',
        new RateLimiterFactory(new ManualClock().now).create({
          windowMs: 60_000,
          max: 2,
          counts: onlyUnauthorized,
        }),
        async (_req, res) => {
          arrived += 1;
          await gate;
          res.status(200).end();
        },
      );
      app.use(createErrorHandler(silentLogger));
      const server = app.listen(0);
      try {
        const parked = [request(server).post('/attempt'), request(server).post('/attempt')].map(
          (call) => call.then((response) => response.status),
        );
        await expect.poll(() => arrived).toBe(2);

        await request(server).post('/attempt').expect(429);

        release();
        expect(await Promise.all(parked)).toEqual([200, 200]);
        // Both answered 200, which does not count: their slots are free again.
        await request(server).post('/attempt').expect(200);
      } finally {
        release();
        server.close();
      }
    });

    it('owner-auth.T06 — a counted response stays counted into the next request of the window only', async () => {
      const clock = new ManualClock();
      const app = appCounting(clock, onlyUnauthorized);

      await request(app).post('/attempt').set('X-Test-Status', '401').expect(401);
      await request(app).post('/attempt').set('X-Test-Status', '401').expect(401);
      await request(app).post('/attempt').expect(429);

      clock.advance(60_000);
      await request(app).post('/attempt').set('X-Test-Status', '401').expect(401);
    });
  });

  it.each([
    { windowMs: 0, max: 1 },
    { windowMs: 1_000, max: 0 },
    { windowMs: 1.5, max: 1 },
  ])('rejects an invalid policy %o', (policy) => {
    expect(() => new RateLimiterFactory().create(policy)).toThrow(RangeError);
  });
});
