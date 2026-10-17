/**
 * One-time-code references in Redis (`owner-auth.T02`; ADR-0008; spec → Password reset by
 * one-time code).
 *
 * `auth:otp-ref:<reference>` → identifier, with a TTL of 24 hours, so an expired code can still
 * be resent by its reference (spec → Edge Cases). The reference is a bcrypt string; its `$`,
 * `.` and `/` characters are ordinary bytes in a Redis key.
 */
import type { IRedisClientProvider } from '../../core/redis/redis-client-provider.interface.js';
import type { IOtpReferenceStore } from './auth.interface.js';

/** Key prefix of every reference. */
const REFERENCE_KEY_PREFIX = 'auth:otp-ref:';

export interface RedisOtpReferenceStoreOptions {
  /** Lifetime of a reference in whole seconds (24 hours). */
  readonly ttlSec: number;
}

export class RedisOtpReferenceStore implements IOtpReferenceStore {
  constructor(
    private readonly redis: IRedisClientProvider,
    private readonly options: RedisOtpReferenceStoreOptions,
  ) {}

  async put(reference: string, identifier: string): Promise<void> {
    await this.redis.getClient().set(referenceKey(reference), identifier, {
      expiration: { type: 'EX', value: this.options.ttlSec },
    });
  }

  async resolve(reference: string): Promise<string | null> {
    return this.redis.getClient().get(referenceKey(reference));
  }

  async delete(reference: string): Promise<void> {
    await this.redis.getClient().del(referenceKey(reference));
  }
}

function referenceKey(reference: string): string {
  return `${REFERENCE_KEY_PREFIX}${reference}`;
}
