/**
 * Domain types of the `health` module. The response payload is owned by `packages/contracts`
 * and re-exported here (`int-standards.express.md` → Input validation).
 */
export { healthReportSchema, type HealthReport } from '@portfolio/contracts';

/** Runtime facts and limits the container hands to `HealthService`. */
export interface HealthServiceOptions {
  /** Version of the running API build, reported as-is. */
  readonly version: string;
  /** Upper bound on the database ping, so the endpoint cannot hang. */
  readonly pingTimeoutMs: number;
  /** Whole seconds since the process started. Injected so the service never reads `process`. */
  readonly uptimeSec: () => number;
}
