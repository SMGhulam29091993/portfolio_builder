/**
 * The one MongoDB connection for the API process.
 *
 * This is the only Singleton the constitution allows (`constitution.md` → Approved LLD patterns,
 * Infrastructure). Outside production the instance is also cached on `globalThis`, so a
 * hot-reloaded module reuses the open pool instead of leaking a new one on every reload. In
 * production the cache is skipped: a restart is a fresh process and must start clean.
 */
import mongoose from 'mongoose';

import type { IDatabaseConnection } from './database-connection.interface.js';

export interface MongoConnectionOptions {
  /** MongoDB connection string. May carry credentials — never log it. */
  readonly uri: string;
  /** How long to wait for a reachable server before `connect()` rejects. */
  readonly serverSelectionTimeoutMs: number;
  /** `false` in production: skip the hot-reload cache on `globalThis`. */
  readonly cacheAcrossReloads: boolean;
}

/** Key on `globalThis` under which the development cache lives. */
const GLOBAL_CACHE_KEY = Symbol.for('portfolio-builder.api.mongo-connection');

/** Shape of `globalThis` with the development cache attached. */
type GlobalWithCache = typeof globalThis & { [GLOBAL_CACHE_KEY]?: MongoConnection };

export class MongoConnection implements IDatabaseConnection {
  /** Instance for the current module evaluation; used in every environment. */
  private static instance: MongoConnection | undefined;

  /** The open connection, or `undefined` before `connect()` / after `disconnect()`. */
  private connection: mongoose.Connection | undefined;

  /** In-flight `connect()` call, shared so concurrent callers open one pool, not two. */
  private pendingConnect: Promise<void> | undefined;

  private constructor(private readonly options: MongoConnectionOptions) {}

  /**
   * Returns the process-wide connection, creating it on first use.
   *
   * Later calls return the existing instance and ignore `options`; the first caller (the
   * startup sequence) decides the configuration.
   */
  static getInstance(options: MongoConnectionOptions): MongoConnection {
    const globalCache = globalThis as GlobalWithCache;

    const existing =
      MongoConnection.instance ??
      (options.cacheAcrossReloads ? globalCache[GLOBAL_CACHE_KEY] : undefined);
    if (existing) {
      MongoConnection.instance = existing;
      return existing;
    }

    const created = new MongoConnection(options);
    MongoConnection.instance = created;
    if (options.cacheAcrossReloads) globalCache[GLOBAL_CACHE_KEY] = created;
    return created;
  }

  async connect(): Promise<void> {
    if (this.isConnected()) return;
    this.pendingConnect ??= this.open().finally(() => {
      this.pendingConnect = undefined;
    });
    return this.pendingConnect;
  }

  /**
   * Closes the pool and releases the singleton, so the next `getInstance()` starts fresh.
   * Graceful shutdown calls this after the HTTP server has drained.
   */
  async disconnect(): Promise<void> {
    const connection = this.connection;
    this.connection = undefined;
    this.releaseSingleton();
    if (connection) await connection.close();
  }

  isConnected(): boolean {
    return this.connection?.readyState === mongoose.ConnectionStates.connected;
  }

  /** Opens a dedicated connection and waits until the server answers. */
  private async open(): Promise<void> {
    const connection = mongoose.createConnection(this.options.uri, {
      serverSelectionTimeoutMS: this.options.serverSelectionTimeoutMs,
    });

    try {
      await connection.asPromise();
    } catch (error) {
      // A failed attempt still holds a client with timers; close it so the process can exit.
      await connection.close().catch(() => undefined);
      throw error;
    }

    this.connection = connection;
  }

  /** Drops this instance from both caches, if it is still the cached one. */
  private releaseSingleton(): void {
    const globalCache = globalThis as GlobalWithCache;
    if (MongoConnection.instance === this) MongoConnection.instance = undefined;
    if (globalCache[GLOBAL_CACHE_KEY] === this) globalCache[GLOBAL_CACHE_KEY] = undefined;
  }
}
