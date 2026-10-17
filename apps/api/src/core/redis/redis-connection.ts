/**
 * The one Redis client for the API process (ADR-0008, `owner-auth.T01`).
 *
 * The second Singleton the constitution allows, beside `MongoConnection` (`constitution.md` →
 * Approved LLD patterns), and built the same way: outside production the instance is also
 * cached on `globalThis`, so a hot-reloaded module reuses the open socket instead of leaking a
 * new one on every reload; in production the cache is skipped and a restart starts clean.
 *
 * Reconnection has two phases, because startup must fail fast but a running process must ride
 * out a blip (ADR-0008):
 * - before the first successful connect, any socket failure ends the attempt, so `connect()`
 *   rejects and `main.ts` exits 1 without opening a port;
 * - once connected, a dropped socket is retried with a capped back-off. Commands issued while
 *   it is down fail, and the callers (the auth guard and routes, from `owner-auth.T05`) answer
 *   503 — nothing waits indefinitely and nothing fails open.
 */
import { createClient } from '@redis/client';

import type { IDatabaseConnection } from '../db/database-connection.interface.js';
import type { ILogger } from '../logger/logger.interface.js';
import type { IRedisClientProvider, RedisClient } from './redis-client-provider.interface.js';

export interface RedisConnectionOptions {
  /** Redis URL (`redis://` or `rediss://`, optional `/<db>`). May carry a password — never log it. */
  readonly url: string;
  /** How long one connection attempt may take before it fails. */
  readonly connectTimeoutMs: number;
  /** `false` in production: skip the hot-reload cache on `globalThis`. */
  readonly cacheAcrossReloads: boolean;
  /** Receives socket errors, which the client emits as events rather than throwing. */
  readonly logger: ILogger;
}

/** First retry delay after a connected socket drops; doubles per attempt up to the cap. */
const RECONNECT_BASE_DELAY_MS = 50;

/** Longest wait between reconnect attempts while the server stays down. */
const RECONNECT_MAX_DELAY_MS = 2_000;

/** Key on `globalThis` under which the development cache lives. */
const GLOBAL_CACHE_KEY = Symbol.for('portfolio-builder.api.redis-connection');

/** Shape of `globalThis` with the development cache attached. */
type GlobalWithCache = typeof globalThis & { [GLOBAL_CACHE_KEY]?: RedisConnection };

export class RedisConnection implements IDatabaseConnection, IRedisClientProvider {
  /** Instance for the current module evaluation; used in every environment. */
  private static instance: RedisConnection | undefined;

  /** The open client, or `undefined` before `connect()` / after `disconnect()`. */
  private client: RedisClient | undefined;

  /** In-flight `connect()` call, shared so concurrent callers open one socket, not two. */
  private pendingConnect: Promise<void> | undefined;

  private constructor(private readonly options: RedisConnectionOptions) {}

  /**
   * Returns the process-wide connection, creating it on first use.
   *
   * Later calls return the existing instance and ignore `options`; the first caller (the
   * startup sequence) decides the configuration.
   */
  static getInstance(options: RedisConnectionOptions): RedisConnection {
    const globalCache = globalThis as GlobalWithCache;

    const existing =
      RedisConnection.instance ??
      (options.cacheAcrossReloads ? globalCache[GLOBAL_CACHE_KEY] : undefined);
    if (existing) {
      RedisConnection.instance = existing;
      return existing;
    }

    const created = new RedisConnection(options);
    RedisConnection.instance = created;
    if (options.cacheAcrossReloads) globalCache[GLOBAL_CACHE_KEY] = created;
    return created;
  }

  /** Opens the socket and resolves only once the server has answered a `PING`. */
  async connect(): Promise<void> {
    if (this.client) return;
    this.pendingConnect ??= this.open().finally(() => {
      this.pendingConnect = undefined;
    });
    return this.pendingConnect;
  }

  /**
   * Closes the client and releases the singleton, so the next `getInstance()` starts fresh.
   * Graceful shutdown calls this after the HTTP server has drained. Pending replies are
   * awaited, so a command already sent is not cut off.
   */
  async disconnect(): Promise<void> {
    const client = this.client;
    this.client = undefined;
    this.releaseSingleton();
    if (client?.isOpen) await client.close();
  }

  getClient(): RedisClient {
    if (!this.client) throw new Error('Redis connection is not open');
    return this.client;
  }

  /** `true` while the socket is up and the client accepts commands. */
  isConnected(): boolean {
    return this.client?.isReady ?? false;
  }

  /** Creates the client, connects it and confirms the server answers. */
  private async open(): Promise<void> {
    // Flipped once the first connect succeeds; the reconnect strategy reads it to tell a
    // startup failure (give up) from a dropped connection (retry).
    let established = false;

    const client: RedisClient = createClient({
      url: this.options.url,
      // While the socket is down, reject a command at once instead of queueing it until the
      // reconnect succeeds: a queued command would hold the request open for as long as Redis
      // stays down, where the spec wants an immediate 503 (`owner-auth.IT13`).
      disableOfflineQueue: true,
      socket: {
        connectTimeout: this.options.connectTimeoutMs,
        reconnectStrategy: (retries, cause) =>
          established
            ? Math.min(RECONNECT_BASE_DELAY_MS * 2 ** retries, RECONNECT_MAX_DELAY_MS)
            : cause,
      },
    });

    // Without a listener an `error` event would crash the process. The client's errors carry
    // the host and port at most — never the URL, so no password reaches the log.
    client.on('error', (error: unknown) => {
      this.options.logger.warn('redis connection error', { error });
    });

    try {
      await client.connect();
      await client.ping();
    } catch (error) {
      // A failed attempt can still hold a socket or timers; release them so the process exits.
      client.destroy();
      throw error;
    }

    established = true;
    this.client = client;
  }

  /** Drops this instance from both caches, if it is still the cached one. */
  private releaseSingleton(): void {
    const globalCache = globalThis as GlobalWithCache;
    if (RedisConnection.instance === this) RedisConnection.instance = undefined;
    if (globalCache[GLOBAL_CACHE_KEY] === this) globalCache[GLOBAL_CACHE_KEY] = undefined;
  }
}
