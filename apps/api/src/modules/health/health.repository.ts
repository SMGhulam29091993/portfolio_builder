/**
 * MongoDB access for the `health` module: one `ping` admin command, no collections
 * (`monorepo-foundation` plan → Data Model).
 */
import type { IMongoConnectionProvider } from '../../core/db/database-connection.interface.js';
import type { IDatabaseProbe } from './health.interface.js';

export class HealthRepository implements IDatabaseProbe {
  constructor(private readonly connections: IMongoConnectionProvider) {}

  async ping(): Promise<void> {
    const db = this.connections.getConnection().db;
    if (!db) throw new Error('MongoDB connection has no database handle');
    await db.admin().ping();
  }
}
