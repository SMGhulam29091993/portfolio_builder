/**
 * Fixture — AC9 (b): a service importing the ODM and the HTTP framework, including a type-only
 * import. Expected: `portfolio/no-framework-in-service` × 2.
 */
import type { Request } from 'express';
import mongoose from 'mongoose';

export class BetaService {
  describe(request: Request): string {
    return `${request.method} ${mongoose.version}`;
  }
}
