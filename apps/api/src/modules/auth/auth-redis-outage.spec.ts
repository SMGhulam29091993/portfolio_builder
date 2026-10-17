/**
 * `owner-auth.IT13`, second half: Redis lost while the API runs → 503 `SERVICE_UNAVAILABLE`
 * from the guard and every auth route, at once, with nothing falling back to "allow"
 * (`owner-auth` spec → Edge Cases; ADR-0008). The startup half is in `main.spec.ts`.
 *
 * The compose Redis is shared by every spec file, so it cannot be stopped here. Instead the
 * API's `RedisConnection` reaches it through a TCP proxy this file owns: cutting the proxy is,
 * to the client, exactly a server that went away, and reopening it is the server coming back.
 */
import { createServer, connect, type Server, type Socket } from 'node:net';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp, type ApiApplication } from '../../app.js';
import { loadEnv } from '../../config/env.js';
import { buildContainer } from '../../container.js';
import { RedisConnection } from '../../core/redis/redis-connection.js';
import { MongoTestHarness, RecordingLogger, RedisTestHarness } from '../../testing/index.js';
import { Argon2PasswordHasher } from './adapters/argon2-password-hasher.js';
import { UserRepository } from './user.repository.js';

const REDIS_HOST = '127.0.0.1';
const REDIS_PORT = 6379;
const JWT_SECRET = 'redis-outage-spec-placeholder-secret-000';
const OWNER_EMAIL = 'outage-owner@example.test';
const OWNER_PASSWORD = 'outage spec password value';
/** Far below any client or socket timeout: an answer this fast was not left waiting. */
const PROMPT_ANSWER_MS = 1_000;

/** A TCP proxy to the test Redis that can be cut and reopened on the same port. */
class RedisProxy {
  private server: Server | undefined;
  private readonly sockets = new Set<Socket>();
  port = 0;

  async open(): Promise<void> {
    const server = createServer((client) => {
      const upstream = connect(REDIS_PORT, REDIS_HOST);
      for (const socket of [client, upstream]) {
        this.sockets.add(socket);
        socket.on('close', () => this.sockets.delete(socket));
        // A cut destroys both ends; the resulting errors are the point, not a failure.
        socket.on('error', () => undefined);
      }
      client.pipe(upstream).pipe(client);
    });
    await new Promise<void>((resolve) => server.listen(this.port, REDIS_HOST, resolve));
    const address = server.address();
    if (address && typeof address === 'object') this.port = address.port;
    this.server = server;
  }

  /** Refuses new connections and drops every open one, as a dead server would. */
  async cut(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    for (const socket of this.sockets) socket.destroy();
    if (!server) return;
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  }
}

let mongo: MongoTestHarness;
let redis: RedisTestHarness;
let connection: RedisConnection;
let proxy: RedisProxy;
let logger: RecordingLogger;
let api: ApiApplication;
/** The cookies of a sign-in made while Redis was up. */
let cookie: string;

beforeAll(async () => {
  mongo = await MongoTestHarness.start();
  // Claim a database, then free the singleton so it can be pointed at the proxy instead.
  redis = await RedisTestHarness.start({ connect: false });
  await redis.connection.disconnect();

  proxy = new RedisProxy();
  await proxy.open();
  logger = new RecordingLogger();
  connection = RedisConnection.getInstance({
    url: `redis://${REDIS_HOST}:${String(proxy.port)}/${String(redis.database)}`,
    connectTimeoutMs: 2_000,
    cacheAcrossReloads: false,
    logger,
  });
  await connection.connect();

  const env = loadEnv({
    NODE_ENV: 'test',
    PORT: '4100',
    MONGODB_URI: mongo.uri,
    REDIS_URL: redis.url,
    JWT_ACCESS_SECRET: JWT_SECRET,
  });
  api = createApp(buildContainer({ env, logger, mongo: mongo.connection, redis: connection }));

  await new UserRepository(mongo.connection).create({
    email: OWNER_EMAIL,
    passwordHash: await new Argon2PasswordHasher().hash(OWNER_PASSWORD),
    displayName: 'Owner',
  });
  const signedIn = await login();
  expect(signedIn.status).toBe(200);
  cookie = (signedIn.headers['set-cookie'] as unknown as string[])
    .map((line) => line.slice(0, line.indexOf(';')))
    .join('; ');
});

afterAll(async () => {
  await connection.disconnect();
  await proxy.cut();
  await mongo.stop();
  await redis.stop();
});

function login(): request.Test {
  return request(api.handler)
    .post('/api/v1/auth/login')
    .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
}

/** Sends `call`, expects a prompt 503 SERVICE_UNAVAILABLE and returns the response. */
async function expectUnavailable(call: () => request.Test): Promise<request.Response> {
  const started = Date.now();
  const response = await call();

  expect(Date.now() - started).toBeLessThan(PROMPT_ANSWER_MS);
  expect(response.status).toBe(503);
  expect(response.body).toEqual({
    success: false,
    message: 'Service unavailable',
    data: { code: 'SERVICE_UNAVAILABLE' },
  });
  return response;
}

describe('auth with Redis lost after startup', () => {
  it('owner-auth.IT13 — the guard and every auth route answer 503 at once, then recover when Redis returns', async () => {
    await proxy.cut();

    // The guard (on /me): never "allow", never a hang.
    await expectUnavailable(() =>
      request(api.handler).get('/api/v1/auth/me').set('Cookie', cookie),
    );
    await expectUnavailable(login);
    // A refresh that could not reach Redis keeps the cookies, so the client can retry.
    const refreshed = await expectUnavailable(() =>
      request(api.handler).post('/api/v1/auth/refresh').set('Cookie', cookie),
    );
    expect(refreshed.headers['set-cookie']).toBeUndefined();
    await expectUnavailable(() =>
      request(api.handler).post('/api/v1/auth/logout').set('Cookie', cookie),
    );

    // The 503s are logged as failures, with the driver error kept as the logged cause.
    expect(logger.entries).toContainEqual(
      expect.objectContaining({
        level: 'error',
        message: 'request failed',
        context: expect.objectContaining({ code: 'SERVICE_UNAVAILABLE' }) as unknown,
      }),
    );

    // Redis comes back: the client reconnects on its own and the session still works.
    await proxy.open();
    await expect
      .poll(
        async () =>
          (await request(api.handler).get('/api/v1/auth/me').set('Cookie', cookie)).status,
        { timeout: 10_000, interval: 100 },
      )
      .toBe(200);
  });

  it('owner-auth.AC15 — nothing logged during the outage carries the password, email or a cookie value', () => {
    const logged = JSON.stringify(logger.entries);
    const cookieValues = cookie.split('; ').map((pair) => pair.slice(pair.indexOf('=') + 1));

    for (const secret of [OWNER_EMAIL, OWNER_PASSWORD, JWT_SECRET, ...cookieValues]) {
      expect(logged).not.toContain(secret);
    }
  });
});
