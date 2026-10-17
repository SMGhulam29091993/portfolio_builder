/**
 * Turns a failed Redis command into 503 `SERVICE_UNAVAILABLE` (`owner-auth` spec → Edge Cases:
 * Redis unreachable at runtime → 503 from the guard and every auth route; `owner-auth.IT13`).
 *
 * Redis-backed stores wrap each command in `whileRedisAvailable`, so no driver error type
 * crosses their port (`int-standards.express.md` → Errors: adapters rethrow, never leak the
 * provider's errors). The driver error is kept as `cause`, which the error middleware logs and
 * never sends. Nothing falls back to "allow": the failure always propagates.
 *
 * A pure helper, so it lives in `core/` (`constitution.md` → Structural non-negotiable).
 */
import { ServiceUnavailableError } from '../errors/index.js';

/** Client-safe message; says nothing about which datastore failed or why. */
const UNAVAILABLE_MESSAGE = 'Service unavailable';

/**
 * Runs one Redis operation and maps any failure to `ServiceUnavailableError`.
 *
 * @param operation - The command(s) to run against the client.
 * @returns What the operation resolved to.
 * @throws {ServiceUnavailableError} When the operation throws or rejects for any reason: a
 *   closed or reconnecting client, a refused socket or a server error reply.
 */
export async function whileRedisAvailable<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw new ServiceUnavailableError({}, UNAVAILABLE_MESSAGE, { cause: error });
  }
}
