/**
 * Startup and graceful shutdown of the API process.
 *
 * Enforces the order required by `constitution.md` → Infrastructure: connect to each datastore
 * in turn and confirm it answered (MongoDB, then Redis — ADR-0008) → build the request handler
 * (the container and app) → listen. A half-configured process never serves traffic
 * (`monorepo-foundation.AC3`): if any datastore fails, the ones already open are closed again
 * and no port is opened. On shutdown it stops accepting connections, lets in-flight requests
 * finish, then closes the datastores in reverse order (`monorepo-foundation.AC13`).
 *
 * Exiting the process is left to the caller (`main.ts`); this class only reports the exit code,
 * which keeps it testable in-process.
 */
import { createServer, type RequestListener, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { IDatabaseConnection } from '../db/database-connection.interface.js';
import type { ILogger } from '../logger/logger.interface.js';

/** A datastore the process must reach before serving, with the name its log lines carry. */
export interface NamedDatastore {
  /** Short, non-secret label for logs, e.g. `mongodb`. Never the connection string. */
  readonly name: string;
  readonly connection: IDatabaseConnection;
}

export interface ApplicationLifecycleOptions {
  /** Port to bind. `0` asks the OS for a free port (tests). */
  readonly port: number;
  /** How long in-flight requests may run after shutdown starts before they are cut off. */
  readonly shutdownGraceMs: number;
}

/** Process exit codes reported by `stop()`. */
export const ExitCode = {
  /** Every in-flight request finished and every datastore closed. */
  Clean: 0,
  /** Shutdown had to cut connections off or failed to close a datastore. */
  Failure: 1,
} as const;
export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

export class ApplicationLifecycle {
  private server: Server | undefined;

  /** The first `stop()` call's result, so repeated signals do not run shutdown twice. */
  private stopping: Promise<ExitCode> | undefined;

  /** Datastores connected so far, in connection order; shutdown closes them in reverse. */
  private readonly connected: NamedDatastore[] = [];

  constructor(
    /** Connected in this order before the handler is built. */
    private readonly datastores: readonly NamedDatastore[],
    /** Builds the request handler; called once, only after every datastore has answered. */
    private readonly createRequestListener: () => RequestListener,
    private readonly logger: ILogger,
    private readonly options: ApplicationLifecycleOptions,
  ) {}

  /**
   * Connects to each datastore in order, builds the request handler, then starts listening.
   *
   * @returns The bound address.
   * @throws When a datastore is unreachable or the handler cannot be built — in both cases no
   *   port has been opened, and every datastore this call opened has been closed again.
   */
  async start(): Promise<AddressInfo> {
    try {
      for (const datastore of this.datastores) {
        await datastore.connection.connect();
        this.connected.push(datastore);
        this.logger.info('database connected', { datastore: datastore.name });
      }
    } catch (error) {
      // Release what did open (MongoDB when Redis fails), so the failed process can exit.
      await this.disconnectAll();
      throw error;
    }

    const server = createServer(this.createRequestListener());
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(this.options.port, () => {
        server.off('error', reject);
        resolve();
      });
    });
    this.server = server;

    const address = server.address() as AddressInfo;
    this.logger.info('http server listening', { port: address.port });
    return address;
  }

  /**
   * Shuts down gracefully. Safe to call more than once; later calls share the first result.
   *
   * @param reason - Why shutdown started (the signal name), for the log.
   * @returns `ExitCode.Clean` when everything drained in time, otherwise `ExitCode.Failure`.
   */
  stop(reason: string): Promise<ExitCode> {
    this.stopping ??= this.shutdown(reason);
    return this.stopping;
  }

  private async shutdown(reason: string): Promise<ExitCode> {
    this.logger.info('shutdown started', { reason });

    const drained = this.server ? await this.closeServer(this.server) : true;
    const datastoresClosed = await this.disconnectAll();

    const exitCode = drained && datastoresClosed ? ExitCode.Clean : ExitCode.Failure;
    this.logger.info('shutdown complete', { exitCode });
    return exitCode;
  }

  /**
   * Closes every connected datastore, newest first, and keeps going past a failure so one
   * stuck datastore cannot leave the others open.
   *
   * @returns `true` when every disconnect succeeded.
   */
  private async disconnectAll(): Promise<boolean> {
    let allClosed = true;
    for (const datastore of this.connected.splice(0).reverse()) {
      try {
        await datastore.connection.disconnect();
        this.logger.info('database disconnected', { datastore: datastore.name });
      } catch (error) {
        allClosed = false;
        this.logger.error('database disconnect failed', { datastore: datastore.name, error });
      }
    }
    return allClosed;
  }

  /**
   * Stops accepting connections and waits for in-flight requests.
   *
   * @returns `true` when every request finished within the grace period, `false` when the
   *   remaining connections had to be destroyed.
   */
  private closeServer(server: Server): Promise<boolean> {
    return new Promise((resolve) => {
      let forced = false;

      const graceTimer = setTimeout(() => {
        forced = true;
        this.logger.warn('shutdown grace period elapsed; closing open connections', {
          shutdownGraceMs: this.options.shutdownGraceMs,
        });
        server.closeAllConnections();
      }, this.options.shutdownGraceMs);
      // The timer alone must never keep the process alive.
      graceTimer.unref();

      server.close(() => {
        clearTimeout(graceTimer);
        this.logger.info('http server closed');
        resolve(!forced);
      });
      // Keep-alive sockets with no request in flight would otherwise hold `close()` open.
      server.closeIdleConnections();
    });
  }
}
