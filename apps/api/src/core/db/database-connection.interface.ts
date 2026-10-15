import type { Connection } from 'mongoose';

/**
 * Lifecycle port for the datastore connection.
 *
 * The startup sequence depends on this interface rather than on `MongoConnection`, so it can be
 * exercised without a database and so the connection type stays an implementation detail.
 */
export interface IDatabaseConnection {
  /**
   * Opens the connection and resolves only once the server has answered.
   * Rejects when the server is unreachable within the configured timeout.
   */
  connect(): Promise<void>;
  /** Closes the connection. Safe to call when it was never opened. */
  disconnect(): Promise<void>;
  /** `true` while the connection is open and usable. */
  isConnected(): boolean;
}

/**
 * Hands repositories the open Mongoose connection (`int-standards.express.md` → Persistence).
 *
 * Kept apart from `IDatabaseConnection` (Interface Segregation): repositories query through the
 * connection but never open or close it. Only repositories may depend on this interface, since
 * it exposes a Mongoose type.
 */
export interface IMongoConnectionProvider {
  /**
   * Returns the open connection. Called per query, not at construction, so the container can
   * be built before the connection opens.
   *
   * While the server is temporarily unreachable the connection is still returned: the driver
   * reconnects on its own, and queries fail or recover through it.
   *
   * @throws {Error} When called before `connect()` succeeded or after `disconnect()`.
   */
  getConnection(): Connection;
}
