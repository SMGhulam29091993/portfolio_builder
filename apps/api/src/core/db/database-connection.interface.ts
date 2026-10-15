/**
 * Lifecycle port for the datastore connection.
 *
 * The startup sequence depends on this interface rather than on `MongoConnection`, so it can be
 * exercised without a database and so the connection type stays an implementation detail.
 * Reachability probing for `GET /api/v1/health` is a separate concern and arrives with
 * `monorepo-foundation.T06` as its own role-sized interface (Interface Segregation).
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
