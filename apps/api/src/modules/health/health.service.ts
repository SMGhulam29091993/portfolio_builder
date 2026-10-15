/**
 * Business logic of `GET /api/v1/health`: report runtime facts only, and turn an unreachable or
 * slow database into `SERVICE_UNAVAILABLE` (`monorepo-foundation.AC4`, `AC5`).
 *
 * The report holds no business payload (`constitution.md` → Security Posture): every field is a
 * runtime fact supplied by the container.
 */
import { ServiceUnavailableError } from '../../core/errors/index.js';
import type { IDatabaseProbe, IHealthService } from './health.interface.js';
import type { HealthReport, HealthServiceOptions } from './health.types.js';

export class HealthService implements IHealthService {
  constructor(
    private readonly probe: IDatabaseProbe,
    private readonly options: HealthServiceOptions,
  ) {}

  async check(): Promise<HealthReport> {
    try {
      await this.pingWithTimeout();
    } catch (error) {
      // The cause is logged by the error middleware; only `db: "down"` reaches the client.
      throw new ServiceUnavailableError({ db: 'down' }, 'Database unavailable', { cause: error });
    }

    return {
      status: 'ok',
      db: 'up',
      version: this.options.version,
      uptimeSec: this.options.uptimeSec(),
    };
  }

  /** Pings the database, rejecting once `pingTimeoutMs` passes without an answer. */
  private async pingWithTimeout(): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Database ping exceeded ${String(this.options.pingTimeoutMs)} ms`));
      }, this.options.pingTimeoutMs);
    });

    try {
      await Promise.race([this.probe.ping(), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
