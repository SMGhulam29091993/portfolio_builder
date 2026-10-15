/**
 * Contracts of the `health` module. Each interface is owned here, on the consuming side
 * (`constitution.md` → SOLID, Dependency Inversion).
 */
import type { HealthReport } from './health.types.js';

/** Liveness + database reachability (`monorepo-foundation.API01`). */
export interface IHealthService {
  /**
   * Builds the health report.
   *
   * @throws {ServiceUnavailableError} With `details.db = "down"` when the database does not
   *   answer within the probe timeout.
   */
  check(): Promise<HealthReport>;
}

/** Reachability probe for the datastore. Health checks only — no query capability. */
export interface IDatabaseProbe {
  /** Resolves when the database answers a `ping`; rejects otherwise. */
  ping(): Promise<void>;
}
