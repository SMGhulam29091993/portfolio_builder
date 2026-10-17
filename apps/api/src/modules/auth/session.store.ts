/**
 * The single auth session per user, in Redis (`owner-auth.T02`; ADR-0008; spec → Session
 * contract).
 *
 * Layout: one hash per user at `auth:session:<userId>` with the fields `jti`,
 * `refreshTokenHash` and `issuedAt` (epoch milliseconds), and a TTL equal to the session
 * lifetime. A hash rather than a JSON string so the Lua scripts below can read the `jti` with
 * `HGET` and no decoding.
 *
 * Every write is one atomic step on the server: `replace` is a `MULTI` transaction, and the two
 * conditional writes are Lua scripts, so a check and its write can never interleave with
 * another request's (`owner-auth.AC10`, `AC11`).
 *
 * Every command runs through `whileRedisAvailable`, so an unreachable server surfaces as 503
 * `SERVICE_UNAVAILABLE` and never as a driver error (`owner-auth.T05`, IT13).
 */
import { whileRedisAvailable } from '../../core/redis/redis-availability.js';
import type { IRedisClientProvider } from '../../core/redis/redis-client-provider.interface.js';
import type { ISessionStore } from './auth.interface.js';
import type { AuthSession } from './auth.types.js';

/** Key prefix of every session hash. */
const SESSION_KEY_PREFIX = 'auth:session:';

/**
 * Replace the session only while its `jti` is still `ARGV[1]`.
 * KEYS[1] = session key; ARGV = expected jti, new jti, new refresh hash, new issuedAt, TTL sec.
 * A missing key makes `HGET` return false, which never equals a string, so it answers 0.
 */
const COMPARE_AND_SET_SCRIPT = `
if redis.call('HGET', KEYS[1], 'jti') ~= ARGV[1] then return 0 end
redis.call('DEL', KEYS[1])
redis.call('HSET', KEYS[1], 'jti', ARGV[2], 'refreshTokenHash', ARGV[3], 'issuedAt', ARGV[4])
redis.call('EXPIRE', KEYS[1], ARGV[5])
return 1
`;

/**
 * Delete the session only while its `jti` is `ARGV[1]`.
 * KEYS[1] = session key. Answers the number of keys deleted (0 or 1).
 */
const DELETE_IF_JTI_SCRIPT = `
if redis.call('HGET', KEYS[1], 'jti') == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0
`;

export interface RedisSessionStoreOptions {
  /** Session lifetime in whole seconds; every write resets the key's TTL to it (7 days). */
  readonly ttlSec: number;
}

export class RedisSessionStore implements ISessionStore {
  constructor(
    private readonly redis: IRedisClientProvider,
    private readonly options: RedisSessionStoreOptions,
  ) {}

  async get(userId: string): Promise<AuthSession | null> {
    const fields = await whileRedisAvailable(() =>
      this.redis.getClient().hGetAll(sessionKey(userId)),
    );
    const { jti, refreshTokenHash, issuedAt } = fields;
    // An empty reply means no session. A partial hash cannot be written by this class; treat
    // it as no session rather than trusting half a record.
    if (!jti || !refreshTokenHash || !issuedAt) return null;
    return { jti, refreshTokenHash, issuedAt: new Date(Number(issuedAt)) };
  }

  async replace(userId: string, session: AuthSession): Promise<void> {
    const key = sessionKey(userId);
    await whileRedisAvailable(() =>
      this.redis
        .getClient()
        .multi()
        .del(key)
        .hSet(key, toFields(session))
        .expire(key, this.options.ttlSec)
        .exec(),
    );
  }

  async compareAndSet(userId: string, expectedJti: string, next: AuthSession): Promise<boolean> {
    const fields = toFields(next);
    const swapped = await whileRedisAvailable(() =>
      this.redis.getClient().eval(COMPARE_AND_SET_SCRIPT, {
        keys: [sessionKey(userId)],
        arguments: [
          expectedJti,
          fields.jti,
          fields.refreshTokenHash,
          fields.issuedAt,
          String(this.options.ttlSec),
        ],
      }),
    );
    return swapped === 1;
  }

  async deleteIfJti(userId: string, expectedJti: string): Promise<boolean> {
    const deleted = await whileRedisAvailable(() =>
      this.redis.getClient().eval(DELETE_IF_JTI_SCRIPT, {
        keys: [sessionKey(userId)],
        arguments: [expectedJti],
      }),
    );
    return deleted === 1;
  }

  async delete(userId: string): Promise<void> {
    await whileRedisAvailable(() => this.redis.getClient().del(sessionKey(userId)));
  }
}

function sessionKey(userId: string): string {
  return `${SESSION_KEY_PREFIX}${userId}`;
}

/** The hash fields for a session; `issuedAt` as epoch milliseconds. */
function toFields(session: AuthSession): {
  jti: string;
  refreshTokenHash: string;
  issuedAt: string;
} {
  return {
    jti: session.jti,
    refreshTokenHash: session.refreshTokenHash,
    issuedAt: String(session.issuedAt.getTime()),
  };
}
