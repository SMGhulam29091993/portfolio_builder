/**
 * HTTP in/out for the `health` module. No logic: delegates to `IHealthService` and wraps the
 * result in the standard envelope. A failure propagates to the error middleware (Express 5).
 */
import type { RequestHandler } from 'express';

import { ok } from '../../core/http/index.js';
import type { IHealthService } from './health.interface.js';

export class HealthController {
  constructor(private readonly health: IHealthService) {}

  /** `GET /api/v1/health` — `monorepo-foundation.API01`. */
  readonly get: RequestHandler = async (_req, res) => {
    ok(res, 'ok', await this.health.check());
  };
}
