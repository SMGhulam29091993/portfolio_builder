/**
 * `IClock` on the system clock (`owner-auth.T03`). The only place the `auth` module reads the
 * current time, so every expiry, cooldown and token lifetime can be tested with a manual clock.
 */
import type { IClock } from '../auth.interface.js';

export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }
}
