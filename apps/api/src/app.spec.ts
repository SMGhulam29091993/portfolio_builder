/**
 * The real app built from the real container, over real HTTP, against a real `mongod` and a
 * real Redis. Re-proves on the live wiring what the core specs proved on test mounts (AC6,
 * AC11). The auth routes have their own end-to-end spec, `modules/auth/auth.routes.spec.ts`.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp, type ApiApplication } from './app.js';
import { loadEnv } from './config/env.js';
import { buildContainer } from './container.js';
import { MongoTestHarness, RecordingLogger, RedisTestHarness } from './testing/index.js';

/** Starts a harness `mongod` and Redis database, connects both singletons and builds the app. */
async function startStack(): Promise<{
  mongo: MongoTestHarness;
  redis: RedisTestHarness;
  api: ApiApplication;
}> {
  const mongo = await MongoTestHarness.start();
  const redis = await RedisTestHarness.start();
  const env = loadEnv({
    NODE_ENV: 'test',
    PORT: '4100',
    MONGODB_URI: mongo.uri,
    REDIS_URL: redis.url,
    JWT_ACCESS_SECRET: 'app-spec-placeholder-jwt-secret-0000000',
    WEB_ORIGIN: 'http://127.0.0.1:3100',
  });
  const api = createApp(
    buildContainer({
      env,
      logger: new RecordingLogger(),
      mongo: mongo.connection,
      redis: redis.connection,
    }),
  );
  return { mongo, redis, api };
}

describe('app with MongoDB reachable', () => {
  let stack: Awaited<ReturnType<typeof startStack>>;

  beforeAll(async () => {
    stack = await startStack();
  });

  afterAll(async () => {
    await stack.mongo.stop();
    await stack.redis.stop();
  });

  it('monorepo-foundation.IT01 / AC4 — GET /api/v1/health answers 200 with the API01 body', async () => {
    const response = await request(stack.api.handler).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'ok',
      data: {
        status: 'ok',
        db: 'up',
        version: expect.any(String) as unknown,
        uptimeSec: expect.any(Number) as unknown,
      },
    });
  });

  it('applies security headers and a request id to every response', async () => {
    const response = await request(stack.api.handler).get('/api/v1/health');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('monorepo-foundation.AC6 — answers an unmatched /api/v1 path with 404 NOT_FOUND', async () => {
    const response = await request(stack.api.handler).get('/api/v1/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: 'Route not found',
      data: { code: 'NOT_FOUND' },
    });
  });

  it('exposes the mounted route table for the drift check', () => {
    expect(stack.api.routes).toEqual([
      { method: 'get', path: '/api/v1/health' },
      { method: 'post', path: '/api/v1/auth/login' },
      { method: 'post', path: '/api/v1/auth/refresh' },
      { method: 'post', path: '/api/v1/auth/logout' },
      { method: 'get', path: '/api/v1/auth/me' },
      { method: 'post', path: '/api/v1/auth/password/forgot' },
      { method: 'post', path: '/api/v1/auth/password/resend' },
      { method: 'post', path: '/api/v1/auth/password/reset' },
      { method: 'get', path: '/api/v1/auth/registration/options' },
      { method: 'post', path: '/api/v1/auth/register' },
      { method: 'post', path: '/api/v1/auth/register/verify' },
      { method: 'post', path: '/api/v1/auth/verification/request' },
      { method: 'post', path: '/api/v1/auth/verification/resend' },
    ]);
  });

  // Runs last in this block: it exhausts the health limiter for this app instance.
  it('monorepo-foundation.AC11 — rate-limits GET /api/v1/health', async () => {
    let lastStatus = 200;
    for (let sent = 0; sent < 100 && lastStatus === 200; sent += 1) {
      lastStatus = (await request(stack.api.handler).get('/api/v1/health')).status;
    }

    const limited = await request(stack.api.handler).get('/api/v1/health');
    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toEqual(expect.stringMatching(/^\d+$/));
    expect(limited.body).toEqual(
      expect.objectContaining({ data: expect.objectContaining({ code: 'RATE_LIMITED' }) as unknown }),
    );
  });
});

describe('app with MongoDB lost after startup', () => {
  it('monorepo-foundation.IT02 / AC5 — GET /api/v1/health answers 503 with db down within the probe timeout', async () => {
    const stack = await startStack();
    try {
      await stack.mongo.stopServer();
      const started = Date.now();

      const response = await request(stack.api.handler).get('/api/v1/health');

      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        success: false,
        message: 'Database unavailable',
        data: { code: 'SERVICE_UNAVAILABLE', db: 'down' },
      });
      // Probe timeout is 1 s; allow scheduling slack, but far below the 5 s driver timeout.
      expect(Date.now() - started).toBeLessThan(2_000);
    } finally {
      await stack.mongo.stop();
      await stack.redis.stop();
    }
  });
});
