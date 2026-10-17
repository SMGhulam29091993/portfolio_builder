/**
 * Errors owned by the `auth` module. Feature-specific codes live next to the feature, not in
 * `core/errors` (`core/errors/http-errors.ts`); the code and status are fixed by
 * `int-standards.express.md` → Error codes.
 */
import { AppError } from '../../core/errors/index.js';

/**
 * 401 `SESSION_EXPIRED` — the access token is genuine but its `jti` no longer matches the `jti`
 * cookie or the stored session, because a newer sign-in or refresh replaced this browser's
 * session (`owner-auth.AC6`, `AC7`). Thrown only after the token's signature was verified, so
 * it tells a caller without a genuine token nothing (spec → Error Handling).
 */
export class SessionExpiredError extends AppError {
  readonly status = 401;

  constructor(message = 'Your session has ended. Please sign in again') {
    super('SESSION_EXPIRED', message);
  }
}
