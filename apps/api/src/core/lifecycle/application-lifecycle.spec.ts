/**
 * In-process tests for the startup order and graceful shutdown. The datastores are fakes of
 * `IDatabaseConnection` — the lifecycle is not part of the data layer, and the real connections
 * are covered by `mongo-connection.spec.ts`, `redis-connection.spec.ts` and the process-level
 * `main.spec.ts`.
 */
import { createServer, request, type RequestListener } from 'node:http';
import { connect } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';

import type { IDatabaseConnection } from '../db/database-connection.interface.js';
import type { ILogger } from '../logger/logger.interface.js';
import { ApplicationLifecycle, ExitCode, type NamedDatastore } from './application-lifecycle.js';

/** What a fake should do when called. */
interface FakeDatabaseBehaviour {
  readonly connectFailure?: Error;
  readonly disconnectFailure?: Error;
}

/**
 * Records the order of datastore calls; `connect` or `disconnect` can be made to fail. Pass one
 * shared `calls` array to several fakes to assert the order across datastores — entries are
 * then prefixed with the fake's name.
 */
class FakeDatabase implements IDatabaseConnection {
  private connected = false;

  constructor(
    private readonly behaviour: FakeDatabaseBehaviour = {},
    readonly calls: string[] = [],
    private readonly name?: string,
  ) {}

  connect(): Promise<void> {
    this.record('connect');
    if (this.behaviour.connectFailure) return Promise.reject(this.behaviour.connectFailure);
    this.connected = true;
    return Promise.resolve();
  }

  disconnect(): Promise<void> {
    this.record('disconnect');
    this.connected = false;
    if (this.behaviour.disconnectFailure) return Promise.reject(this.behaviour.disconnectFailure);
    return Promise.resolve();
  }

  private record(call: string): void {
    this.calls.push(this.name ? `${this.name} ${call}` : call);
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

/** Wraps one fake as the single datastore most tests need. */
function only(database: IDatabaseConnection): NamedDatastore[] {
  return [{ name: 'fake', connection: database }];
}

/** Builds a lifecycle on an OS-assigned port and tracks it for cleanup. */
function createLifecycle(
  database: IDatabaseConnection | readonly NamedDatastore[],
  listener: RequestListener = respondOk,
  shutdownGraceMs = 5_000,
): ApplicationLifecycle {
  const datastores = Array.isArray(database) ? database : only(database as IDatabaseConnection);
  const lifecycle = new ApplicationLifecycle(datastores, () => listener, silentLogger, {
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
  it('connects, then builds the request handler, then listens', async () => {
    const database = new FakeDatabase();
    const lifecycle = new ApplicationLifecycle(
      only(database),
      () => {
        database.calls.push('build handler');
        return respondOk;
      },
      silentLogger,
      { port: 0, shutdownGraceMs: 5_000 },
    );
    started.push(lifecycle);

    const { port } = await lifecycle.start();

    expect(database.calls).toEqual(['connect', 'build handler']);
    await expect(get(port)).resolves.toBe('ok');
  });

  it('monorepo-foundation.AC3 — never builds the app or opens a port when the datastore is unreachable', async () => {
    const port = await findFreePort();
    let handlerBuilt = false;
    const lifecycle = new ApplicationLifecycle(
      only(new FakeDatabase({ connectFailure: new Error('server selection timed out') })),
      () => {
        handlerBuilt = true;
        return respondOk;
      },
      silentLogger,
      { port, shutdownGraceMs: 5_000 },
    );

    await expect(lifecycle.start()).rejects.toThrow('server selection timed out');
    await expect(isPortOpen(port)).resolves.toBe(false);
    expect(handlerBuilt).toBe(false);
  });

  it('owner-auth.T01 — connects every datastore in order before building the handler', async () => {
    const calls: string[] = [];
    const lifecycle = new ApplicationLifecycle(
      [
        { name: 'mongodb', connection: new FakeDatabase({}, calls, 'mongodb') },
        { name: 'redis', connection: new FakeDatabase({}, calls, 'redis') },
      ],
      () => {
        calls.push('build handler');
        return respondOk;
      },
      silentLogger,
      { port: 0, shutdownGraceMs: 5_000 },
    );
    started.push(lifecycle);

    await lifecycle.start();

    expect(calls).toEqual(['mongodb connect', 'redis connect', 'build handler']);
  });

  it('owner-auth.IT13 — closes MongoDB again and opens no port when Redis is unreachable', async () => {
    const port = await findFreePort();
    const calls: string[] = [];
    let handlerBuilt = false;
    const lifecycle = new ApplicationLifecycle(
      [
        { name: 'mongodb', connection: new FakeDatabase({}, calls, 'mongodb') },
        {
          name: 'redis',
          connection: new FakeDatabase(
            { connectFailure: new Error('connect ECONNREFUSED') },
            calls,
            'redis',
          ),
        },
      ],
      () => {
        handlerBuilt = true;
        return respondOk;
      },
      silentLogger,
      { port, shutdownGraceMs: 5_000 },
    );

    await expect(lifecycle.start()).rejects.toThrow('connect ECONNREFUSED');
    await expect(isPortOpen(port)).resolves.toBe(false);
    expect(handlerBuilt).toBe(false);
    // Redis never opened, so only MongoDB is closed.
    expect(calls).toEqual(['mongodb connect', 'redis connect', 'mongodb disconnect']);
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

  it('owner-auth.T01 — closes datastores in reverse order after the server drains', async () => {
    const calls: string[] = [];
    const lifecycle = createLifecycle([
      { name: 'mongodb', connection: new FakeDatabase({}, calls, 'mongodb') },
      { name: 'redis', connection: new FakeDatabase({}, calls, 'redis') },
    ]);
    await lifecycle.start();

    await expect(lifecycle.stop('SIGTERM')).resolves.toBe(ExitCode.Clean);

    expect(calls).toEqual(['mongodb connect', 'redis connect', 'redis disconnect', 'mongodb disconnect']);
  });

  it('owner-auth.T01 — still closes the other datastores when one disconnect fails, and reports failure', async () => {
    const calls: string[] = [];
    const lifecycle = createLifecycle([
      { name: 'mongodb', connection: new FakeDatabase({}, calls, 'mongodb') },
      {
        name: 'redis',
        connection: new FakeDatabase({ disconnectFailure: new Error('socket hang up') }, calls, 'redis'),
      },
    ]);
    await lifecycle.start();

    await expect(lifecycle.stop('SIGTERM')).resolves.toBe(ExitCode.Failure);

    expect(calls).toEqual(['mongodb connect', 'redis connect', 'redis disconnect', 'mongodb disconnect']);
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
