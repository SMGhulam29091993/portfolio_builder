import type { RedisClientType } from '@redis/client';

/**
 * The Redis client type the API uses: no modules, scripts or functions registered on the
 * client itself (Lua scripts are passed per call), default RESP version.
 */
export type RedisClient = RedisClientType;

/**
 * Hands Redis-backed stores the open client (ADR-0008).
 *
 * The Redis counterpart of `IMongoConnectionProvider`, and kept apart from
 * `IDatabaseConnection` for the same reason (Interface Segregation): stores issue commands but
 * never open or close the connection. Only Redis-backed stores in the `auth` module may depend
 * on this interface, since it exposes the driver's client type and ADR-0008 scopes Redis to
 * `auth`.
 */
export interface IRedisClientProvider {
  /**
   * Returns the open client. Called per command, not at construction, so the container can be
   * built before the connection opens.
   *
   * While the server is temporarily unreachable the client is still returned: it reconnects on
   * its own, and commands fail or recover through it.
   *
   * @throws {Error} When called before `connect()` succeeded or after `disconnect()`.
   */
  getClient(): RedisClient;
}
