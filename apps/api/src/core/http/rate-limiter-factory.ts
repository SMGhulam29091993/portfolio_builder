/**
 * Builds rate-limiting middleware from a policy (Factory — `constitution.md` → Approved LLD
 * patterns). Each mount that needs limiting (`/health` now; auth, AI and public routes later)
 * asks the factory for a limiter with its own policy and its own counters.
 *
 * Counting is a fixed window held in process memory: counters reset on restart and are
 * per-instance (`monorepo-foundation` → Edge Cases). ADR-0008 admits Redis for auth sessions
 * only and keeps these counters in memory, so no shared store is abstracted here.
 *
 * Over the limit, the middleware forwards `RateLimitedError`; the error middleware turns it into
 * 429 `RATE_LIMITED` with `Retry-After` (`monorepo-foundation.AC11`).
 *
 * A policy may count only some outcomes — the login limiter counts failed sign-ins only
 * (`owner-auth.AC3`). Every admitted request still takes its slot on arrival, and gives it back
 * once its response turns out not to count; holding the slot while the request is in flight is
 * what stops a burst of parallel attempts from all passing before the first one fails.
 */
import type { Request, RequestHandler } from 'express';

import { RateLimitedError } from '../errors/index.js';

export interface RateLimitPolicy {
  /** Length of one counting window, in milliseconds. */
  readonly windowMs: number;
  /** Requests allowed per client within one window. */
  readonly max: number;
  /**
   * Identifies the client a request counts against. Defaults to `req.ip`. Until the deployment
   * target sets Express's `trust proxy`, requests relayed by the web app share the proxy's IP.
   */
  readonly keyOf?: (req: Request) => string;
  /**
   * Decides from the finished response's status whether the request counts against the limit.
   * Defaults to counting every request. A request whose response never finishes (the client
   * went away) keeps its slot, so aborting cannot be used to dodge the count.
   */
  readonly counts?: (status: number) => boolean;
}

/** One client's counter in the current window. */
interface WindowCounter {
  count: number;
  /** Epoch milliseconds at which this window ends. */
  resetAt: number;
}

/** Key used when Express cannot determine the client address. */
const UNKNOWN_CLIENT = 'unknown';

const defaultKeyOf = (req: Request): string => req.ip ?? UNKNOWN_CLIENT;

export class RateLimiterFactory {
  /**
   * @param now - Clock in epoch milliseconds; injectable so tests can move between windows.
   */
  constructor(private readonly now: () => number = Date.now) {}

  /**
   * Creates a limiter with its own counters.
   *
   * @throws {RangeError} When the policy is not a positive window and a positive whole limit.
   */
  create(policy: RateLimitPolicy): RequestHandler {
    assertValidPolicy(policy);

    const counters = new Map<string, WindowCounter>();
    const keyOf = policy.keyOf ?? defaultKeyOf;
    let nextSweepAt = this.now() + policy.windowMs;

    return (req, res, next) => {
      const now = this.now();

      // Drop expired counters once per window so memory tracks active clients only.
      if (now >= nextSweepAt) {
        for (const [key, counter] of counters) if (counter.resetAt <= now) counters.delete(key);
        nextSweepAt = now + policy.windowMs;
      }

      const key = keyOf(req);
      let counter = counters.get(key);
      if (!counter || counter.resetAt <= now) {
        counter = { count: 0, resetAt: now + policy.windowMs };
        counters.set(key, counter);
      }

      // A rejected request takes no slot: only admitted requests are counted.
      if (counter.count >= policy.max) {
        next(new RateLimitedError(Math.ceil((counter.resetAt - now) / 1000)));
        return;
      }
      counter.count += 1;

      const { counts } = policy;
      if (counts) {
        const admittedIn = counter;
        res.once('finish', () => {
          // Giving back to `admittedIn` rather than the map entry: if the window has rolled over
          // since, the slot belonged to the old window and the new one is left untouched.
          if (!counts(res.statusCode) && admittedIn.count > 0) admittedIn.count -= 1;
        });
      }

      next();
    };
  }
}

function assertValidPolicy({ windowMs, max }: RateLimitPolicy): void {
  if (!Number.isInteger(windowMs) || windowMs <= 0) {
    throw new RangeError('Rate limit windowMs must be a positive integer');
  }
  if (!Number.isInteger(max) || max <= 0) {
    throw new RangeError('Rate limit max must be a positive integer');
  }
}
