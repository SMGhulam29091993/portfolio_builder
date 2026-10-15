/**
 * In-process tests for the startup order and graceful shutdown. The datastore is a fake of
 * `IDatabaseConnection` — the lifecycle is not part of the data layer, and the real connection
 * is covered by `mongo-connection.spec.ts` and the process-level `main.spec.ts`.
 */
import { createServer, request, type RequestListener } from 'node:http';
import { connect } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';

import type { IDatabaseConnection } from '../db/database-connection.interface.js';
import type { ILogger } from '../logger/logger.interface.js';
import { ApplicationLifecycle, ExitCode } from './application-lifecycle.js';

/** Records the order of datastore calls; `connect` can be made to fail. */
class FakeDatabase implements IDatabaseConnection {
  readonly calls: string[] = [];
  private connected = false;

  constructor(private readonly failure?: Error) {}

  connect(): Promise<void> {
    this.calls.push('connect');
    if (this.failure) return Promise.reject(this.failure);
    this.connected = true;
    return Promise.resolve();
  }

  disconnect(): Promise<void> {
    this.calls.push('disconnect');
    this.connected = false;
    return Promise.resolve();
  }

  isConnected(): boolean {
    return this.connected;
  }
}

const silentLogger: ILogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const respondOk: RequestListener = (_req, res) => {
  res.end('ok');
};

const started: ApplicationLifecycle[] = [];

/** Builds a lifecycle on an OS-assigned port and tracks it for cleanup. */
function createLifecycle(
  database: IDatabaseConnection,
  listener: RequestListener = respondOk,
  shutdownGraceMs = 5_000,
): ApplicationLifecycle {
  const lifecycle = new ApplicationLifecycle(database, listener, silentLogger, {
    port: 0,
    shutdownGraceMs,
  });
  started.push(lifecycle);
  return lifecycle;
}

/** Sends a GET and resolves with the response body. */
function get(port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = request({ port, path: '/', agent: false }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => (body += chunk));
      res.on('end', () => {
        resolve(body);
      });
    });
    req.on('error', reject);
    req.end();
  });
}

/** Resolves `true` when something accepts TCP connections on `port`. */
function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      resolve(false);
    });
  });
}

/** Finds a port that is free right now by binding to 0 and releasing it. */
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

afterEach(async () => {
  await Promise.all(started.splice(0).map((lifecycle) => lifecycle.stop('test cleanup')));
});

describe('ApplicationLifecycle.start', () => {
  it('connects to the datastore before it starts listening', async () => {
    const database = new FakeDatabase();
    const lifecycle = createLifecycle(database);

    const { port } = await lifecycle.start();

    expect(database.calls).toEqual(['connect']);
    await expect(get(port)).resolves.toBe('ok');
  });

  it('monorepo-foundation.AC3 — never opens a port when the datastore is unreachable', async () => {
    const port = await findFreePort();
    const lifecycle = new ApplicationLifecycle(
      new FakeDatabase(new Error('server selection timed out')),
      respondOk,
      silentLogger,
      { port, shutdownGraceMs: 5_000 },
    );

    await expect(lifecycle.start()).rejects.toThrow('server selection timed out');
    await expect(isPortOpen(port)).resolves.toBe(false);
  });
});

describe('ApplicationLifecycle.stop', () => {
  it('monorepo-foundation.AC13 — lets an in-flight request finish, then closes the datastore', async () => {
    const database = new FakeDatabase();
    let releaseRequest: () => void = () => undefined;
    let markRequestStarted: () => void = () => undefined;
    const requestStarted = new Promise<void>((resolve) => (markRequestStarted = resolve));
    const slowListener: RequestListener = (_req, res) => {
      markRequestStarted();
      releaseRequest = () => res.end('finished');
    };
    const lifecycle = createLifecycle(database, slowListener);
    const { port } = await lifecycle.start();

    const inFlight = get(port);
    await requestStarted;
    const stopping = lifecycle.stop('SIGTERM');

    // The port stops accepting new connections while the first request is still open.
    await expect(isPortOpen(port)).resolves.toBe(false);
    expect(database.calls).toEqual(['connect']);

    releaseRequest();

    await expect(inFlight).resolves.toBe('finished');
    await expect(stopping).resolves.toBe(ExitCode.Clean);
    expect(database.calls).toEqual(['connect', 'disconnect']);
  });

  it('cuts off requests that outlive the grace period and reports a failure exit code', async () => {
    const database = new FakeDatabase();
    let markRequestStarted: () => void = () => undefined;
    const requestStarted = new Promise<void>((resolve) => (markRequestStarted = resolve));
    const hangingListener: RequestListener = () => {
      markRequestStarted();
    };
    const lifecycle = createLifecycle(database, hangingListener, 50);
    const { port } = await lifecycle.start();

    const inFlight = get(port);
    await requestStarted;

    await expect(lifecycle.stop('SIGTERM')).resolves.toBe(ExitCode.Failure);
    await expect(inFlight).rejects.toThrow();
    expect(database.calls).toEqual(['connect', 'disconnect']);
  });

  it('runs shutdown once when stop is called repeatedly', async () => {
    const database = new FakeDatabase();
    const lifecycle = createLifecycle(database);
    await lifecycle.start();

    const [first, second] = await Promise.all([
      lifecycle.stop('SIGTERM'),
      lifecycle.stop('SIGINT'),
    ]);

    expect(first).toBe(ExitCode.Clean);
    expect(second).toBe(ExitCode.Clean);
    expect(database.calls).toEqual(['connect', 'disconnect']);
  });
});
