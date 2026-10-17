/**
 * `owner-auth.CT04` — shared contract suite for `IOtpReferenceStore`, run against
 * `RedisOtpReferenceStore` on a real Redis (ADR-0008) and against `InMemoryOtpReferenceStore`
 * (`constitution.md` → Liskov Substitution). Then a Redis-only check of the stored layout.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { InMemoryOtpReferenceStore, RedisTestHarness } from '../../testing/index.js';
import type { IOtpReferenceStore } from './auth.interface.js';
import { RedisOtpReferenceStore } from './otp-reference.store.js';

interface StoreUnderTest {
  readonly store: IOtpReferenceStore;
  readonly elapse: (ms: number) => Promise<void>;
}

interface ContractSubject {
  readonly name: string;
  readonly create: (ttlSec: number) => StoreUnderTest;
}

/** The spec's reference lifetime: 24 hours. */
const REFERENCE_TTL_SEC = 24 * 60 * 60;

/** Shaped like a real reference: a bcrypt string, with `$`, `.` and `/` in it. */
const REFERENCE = '$2b$10$N9qo8uLOickgx2ZMRZoMye.IjZAgcfl7p92ldGxad68LJZdL17lhW';
const IDENTIFIER = 'f'.repeat(64);

let redis: RedisTestHarness;

beforeAll(async () => {
  redis = await RedisTestHarness.start();
});

afterEach(async () => {
  await redis.reset();
});

afterAll(async () => {
  await redis.stop();
});

const subjects: readonly ContractSubject[] = [
  {
    name: 'RedisOtpReferenceStore',
    create: (ttlSec) => ({
      store: new RedisOtpReferenceStore(redis.connection, { ttlSec }),
      elapse: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    }),
  },
  {
    name: 'InMemoryOtpReferenceStore',
    create: (ttlSec) => {
      let now = Date.UTC(2026, 0, 1);
      return {
        store: new InMemoryOtpReferenceStore({ ttlSec }, () => now),
        elapse: (ms) => {
          now += ms;
          return Promise.resolve();
        },
      };
    },
  },
];

describe.each(subjects)('owner-auth.CT04 — IOtpReferenceStore contract — $name', (subject) => {
  it('owner-auth.AC16 — resolves a stored reference to its identifier', async () => {
    const { store } = subject.create(REFERENCE_TTL_SEC);

    await store.put(REFERENCE, IDENTIFIER);

    await expect(store.resolve(REFERENCE)).resolves.toBe(IDENTIFIER);
  });

  it('owner-auth.AC17 — resolves an unknown reference to null', async () => {
    const { store } = subject.create(REFERENCE_TTL_SEC);

    await expect(store.resolve(REFERENCE)).resolves.toBeNull();
  });

  it('put() overwrites an existing mapping', async () => {
    const { store } = subject.create(REFERENCE_TTL_SEC);
    await store.put(REFERENCE, IDENTIFIER);

    await store.put(REFERENCE, 'e'.repeat(64));

    await expect(store.resolve(REFERENCE)).resolves.toBe('e'.repeat(64));
  });

  it('owner-auth.AC21 — delete() removes the mapping and tolerates a missing one', async () => {
    const { store } = subject.create(REFERENCE_TTL_SEC);
    await store.put(REFERENCE, IDENTIFIER);

    await store.delete(REFERENCE);
    await store.delete(REFERENCE);

    await expect(store.resolve(REFERENCE)).resolves.toBeNull();
  });

  it('a reference expires after the TTL', async () => {
    const { store, elapse } = subject.create(1);
    await store.put(REFERENCE, IDENTIFIER);

    await elapse(1_200);

    await expect(store.resolve(REFERENCE)).resolves.toBeNull();
  });
});

describe('RedisOtpReferenceStore layout (ADR-0008)', () => {
  it('stores a string at auth:otp-ref:<reference> with the configured TTL', async () => {
    const store = new RedisOtpReferenceStore(redis.connection, { ttlSec: REFERENCE_TTL_SEC });

    await store.put(REFERENCE, IDENTIFIER);

    const client = redis.connection.getClient();
    await expect(client.get(`auth:otp-ref:${REFERENCE}`)).resolves.toBe(IDENTIFIER);
    const ttl = await client.ttl(`auth:otp-ref:${REFERENCE}`);
    expect(ttl).toBeGreaterThan(REFERENCE_TTL_SEC - 5);
    expect(ttl).toBeLessThanOrEqual(REFERENCE_TTL_SEC);
  });
});
