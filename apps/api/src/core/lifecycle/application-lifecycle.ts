/**
 * Startup and graceful shutdown of the API process.
 *
 * Enforces the order required by `constitution.md` → Infrastructure: the datastore must be
 * reachable before a port is opened, so a half-configured process never serves traffic
 * (`monorepo-foundation.AC3`). On shutdown it stops accepting connections, lets in-flight
 * requests finish, then closes the datastore (`monorepo-foundation.AC13`).
 *
 * Exiting the process is left to the caller (`main.ts`); this class only reports the exit code,
 * which keeps it testable in-process.
 */
import { createServer, type RequestListener, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { IDatabaseConnection } from '../db/database-connection.interface.js';
import type { ILogger } from '../logger/logger.interface.js';

export interface ApplicationLifecycleOptions {
  /** Port to bind. `0` asks the OS for a free port (tests). */
  readonly port: number;
  /** How long in-flight requests may run after shutdown starts before they are cut off. */
  readonly shutdownGraceMs: number;
}

/** Process exit codes reported by `stop()`. */
export const ExitCode = {
  /** Every in-flight request finished and the datastore closed. */
  Clean: 0,
  /** Shutdown had to cut connections off or failed to close the datastore. */
  Failure: 1,
} as const;
export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

export class ApplicationLifecycle {
  private server: Server | undefined;

  /** The first `stop()` call's result, so repeated signals do not run shutdown twice. */
  private stopping: Promise<ExitCode> | undefined;

  constructor(
    private readonly database: IDatabaseConnection,
    private readonly requestListener: RequestListener,
    private readonly logger: ILogger,
    private readonly options: ApplicationLifecycleOptions,
  ) {}

  /**
   * Connects to the datastore, then starts listening.
   *
   * @returns The bound address.
   * @throws When the datastore is unreachable — in that case no port has been opened.
   */
  async start(): Promise<AddressInfo> {
    await this.database.connect();
    this.logger.info('database connected');

    const server = createServer(this.requestListener);
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

    let databaseClosed = true;
    try {
      await this.database.disconnect();
      this.logger.info('database disconnected');
    } catch (error) {
      databaseClosed = false;
      this.logger.error('database disconnect failed', { error });
    }

    const exitCode = drained && databaseClosed ? ExitCode.Clean : ExitCode.Failure;
    this.logger.info('shutdown complete', { exitCode });
    return exitCode;
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
