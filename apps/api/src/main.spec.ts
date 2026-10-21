/**
 * Process-level tests for the entry point: each case spawns `src/main.ts` as a real child
 * process (through tsx) with a controlled environment, then asserts its exit code and logs.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { RedisTestHarness } from './testing/index.js';

const API_ROOT = fileURLToPath(new URL('..', import.meta.url));

/** A credential that must never appear in any log line. */
const FAKE_SECRET = 'not-a-real-secret';

/** Satisfies `JWT_ACCESS_SECRET` validation; like every secret, it must never be logged. */
const JWT_ACCESS_SECRET = 'main-spec-placeholder-jwt-secret-000000';

/** Satisfies `WEB_ORIGIN` validation; no request in this file sends an `Origin`. */
const WEB_ORIGIN = 'http://127.0.0.1:3100';

interface LogLine {
  readonly level: string;
  readonly msg: string;
  readonly [field: string]: unknown;
}

interface RunningApi {
  readonly child: ChildProcess;
  readonly lines: LogLine[];
  /** Raw stdout + stderr, for secret-leak assertions. */
  readonly output: () => string;
  readonly exited: Promise<number | null>;
}

let mongo: MongoMemoryServer;
/** Claims a Redis database for the spawned API; this process never connects to it. */
let redis: RedisTestHarness;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  redis = await RedisTestHarness.start({ connect: false });
});

afterAll(async () => {
  await mongo.stop();
  await redis.stop();
});

/**
 * Spawns the API with exactly `env` — nothing is inherited, so no developer variable can mask a
 * missing one. Node is started by absolute path, so `PATH` is not needed.
 */
function startApi(env: Record<string, string>): RunningApi {
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
    cwd: API_ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let raw = '';
  let pending = '';
  const lines: LogLine[] = [];
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
    raw += chunk;
    pending += chunk;
    const complete = pending.split('\n');
    pending = complete.pop() ?? '';
    for (const line of complete) if (line) lines.push(JSON.parse(line) as LogLine);
  });
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => (raw += chunk));

  const exited = new Promise<number | null>((resolve) => child.once('exit', resolve));
  return { child, lines, output: () => raw, exited };
}

/** Resolves once a log line with `msg` appears; rejects if the process exits first. */
async function waitForLog(api: RunningApi, msg: string): Promise<LogLine> {
  for (;;) {
    const found = api.lines.find((line) => line.msg === msg);
    if (found) return found;
    if (api.child.exitCode !== null) throw new Error(`process exited before logging "${msg}"`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

/** Finds a port that is free right now. */
async function findFreePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolve) => probe.listen(0, resolve));
  const { port } = probe.address() as { port: number };
  await new Promise<void>((resolve) => {
    probe.close(() => {
      resolve();
    });
  });
  return port;
}

describe('main', () => {
  it('monorepo-foundation.AC2 — exits 1 naming a missing variable, never a value', async () => {
    const api = startApi({ NODE_ENV: 'test', PORT: '4999' });

    await expect(api.exited).resolves.toBe(1);
    expect(api.lines).toContainEqual(
      expect.objectContaining({
        level: 'error',
        msg: 'invalid environment configuration',
        variables: ['MONGODB_URI', 'REDIS_URL', 'JWT_ACCESS_SECRET', 'WEB_ORIGIN'],
      }),
    );
    expect(api.output()).not.toContain('4999');
  });

  it('monorepo-foundation.AC2 — does not echo a malformed secret value', async () => {
    const api = startApi({
      NODE_ENV: 'test',
      PORT: '4999',
      MONGODB_URI: `postgres://svc:${FAKE_SECRET}@db.internal/portfolio`,
      REDIS_URL: redis.url,
      JWT_ACCESS_SECRET,
      WEB_ORIGIN,
    });

    await expect(api.exited).resolves.toBe(1);
    expect(api.lines.at(-1)).toEqual(expect.objectContaining({ variables: ['MONGODB_URI'] }));
    expect(api.output()).not.toContain(FAKE_SECRET);
  });

  it('monorepo-foundation.IT03 — exits 1 without opening a port when MongoDB is unreachable', async () => {
    const port = await findFreePort();
    const api = startApi({
      NODE_ENV: 'test',
      PORT: String(port),
      MONGODB_URI: `mongodb://svc:${FAKE_SECRET}@127.0.0.1:1/portfolio`,
      REDIS_URL: redis.url,
      JWT_ACCESS_SECRET,
      WEB_ORIGIN,
    });

    await expect(api.exited).resolves.toBe(1);
    expect(api.lines.map((line) => line.msg)).not.toContain('http server listening');
    expect(api.lines).toContainEqual(
      expect.objectContaining({ level: 'error', msg: 'startup failed' }),
    );
    expect(api.output()).not.toContain(FAKE_SECRET);
  });

  it('owner-auth.IT13 — exits 1 without opening a port when Redis is unreachable, closing MongoDB', async () => {
    const port = await findFreePort();
    const api = startApi({
      NODE_ENV: 'test',
      PORT: String(port),
      MONGODB_URI: mongo.getUri(),
      REDIS_URL: `redis://default:${FAKE_SECRET}@127.0.0.1:1/0`,
      JWT_ACCESS_SECRET,
      WEB_ORIGIN,
    });

    await expect(api.exited).resolves.toBe(1);
    const messages = api.lines.map((line) => line.msg);
    expect(messages).not.toContain('http server listening');
    // MongoDB had opened, so it is closed again before the failure is reported.
    expect(api.lines).toContainEqual(
      expect.objectContaining({ msg: 'database disconnected', datastore: 'mongodb' }),
    );
    expect(api.lines).toContainEqual(
      expect.objectContaining({ level: 'error', msg: 'startup failed' }),
    );
    expect(api.output()).not.toContain(FAKE_SECRET);
  });

  it('owner-auth.IT22 — refuses to start in production without a mail strategy, naming the variables', async () => {
    const port = await findFreePort();
    const api = startApi({
      NODE_ENV: 'production',
      PORT: String(port),
      MONGODB_URI: mongo.getUri(),
      REDIS_URL: redis.url,
      JWT_ACCESS_SECRET,
      WEB_ORIGIN,
    });

    await expect(api.exited).resolves.toBe(1);
    expect(api.lines.map((line) => line.msg)).not.toContain('http server listening');
    const failure = api.lines.find((line) => line.msg === 'startup failed');
    expect(failure).toEqual(
      expect.objectContaining({
        level: 'error',
        error: expect.objectContaining({
          name: 'MailNotConfiguredError',
          message: expect.stringContaining('GMAIL_USER, GMAIL_APP_PASSWORD') as unknown,
        }) as unknown,
      }),
    );
    // Both datastores had opened before the container was built; both are closed again.
    const closed = api.lines
      .filter((line) => line.msg === 'database disconnected')
      .map((line) => line.datastore);
    expect(closed).toEqual(['redis', 'mongodb']);
    expect(api.output()).not.toContain(JWT_ACCESS_SECRET);
  });

  it.each([
    ['AI_PROVIDER unset', {}, 'AI_PROVIDER'],
    ['AI_PROVIDER=ollama', { AI_PROVIDER: 'ollama', OLLAMA_BASE_URL: 'http://127.0.0.1:1', AI_MODEL: 'local' }, 'AI_PROVIDER'],
    ['gemini without AI_MODEL', { AI_PROVIDER: 'gemini', GEMINI_API_KEY: FAKE_SECRET }, 'AI_MODEL'],
  ])('ai-design-studio.IT10 — production with %s exits 1 naming %s, never the key', async (_row, ai, variable) => {
    const port = await findFreePort();
    const api = startApi({
      NODE_ENV: 'production',
      PORT: String(port),
      MONGODB_URI: mongo.getUri(),
      REDIS_URL: redis.url,
      JWT_ACCESS_SECRET,
      WEB_ORIGIN,
      // Mail and revalidation are configured, so the AI rule is the one that refuses.
      SMTP_URL: 'smtp://127.0.0.1:1',
      MAIL_FROM: 'noreply@example.test',
      WEB_REVALIDATE_URL: 'http://127.0.0.1:1/api/revalidate',
      REVALIDATE_SECRET: 'r'.repeat(32),
      ...ai,
    });

    await expect(api.exited).resolves.toBe(1);
    expect(api.lines.map((line) => line.msg)).not.toContain('http server listening');
    const failure = api.lines.find((line) => line.msg === 'startup failed');
    expect(failure).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          name: 'EnvValidationError',
          message: `Invalid environment configuration: ${variable}`,
        }) as unknown,
      }),
    );
    expect(api.output()).not.toContain(FAKE_SECRET);
  });

  it('monorepo-foundation.AC4 / AC13 — serves /api/v1/health, then on SIGTERM closes Redis and MongoDB and exits 0', async () => {
    const port = await findFreePort();
    const api = startApi({
      NODE_ENV: 'test',
      PORT: String(port),
      MONGODB_URI: mongo.getUri(),
      REDIS_URL: redis.url,
      JWT_ACCESS_SECRET,
      WEB_ORIGIN,
    });

    const listening = await waitForLog(api, 'http server listening');
    expect(listening.port).toBe(port);

    const health = await fetch(`http://127.0.0.1:${String(port)}/api/v1/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual(
      expect.objectContaining({ data: expect.objectContaining({ db: 'up' }) as unknown }),
    );

    api.child.kill('SIGTERM');

    await expect(api.exited).resolves.toBe(0);
    expect(api.output()).not.toContain(JWT_ACCESS_SECRET);
    const messages = api.lines.map((line) => line.msg);
    expect(messages).toEqual(
      expect.arrayContaining(['shutdown started', 'http server closed', 'database disconnected']),
    );
    expect(messages.indexOf('http server closed')).toBeLessThan(
      messages.indexOf('database disconnected'),
    );
    // owner-auth.T01: both datastores connected at startup and closed newest first.
    const closed = api.lines
      .filter((line) => line.msg === 'database disconnected')
      .map((line) => line.datastore);
    expect(closed).toEqual(['redis', 'mongodb']);
  });
});
