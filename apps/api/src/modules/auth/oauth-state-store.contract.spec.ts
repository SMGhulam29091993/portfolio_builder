/**
 * `google-sign-in.CT01` — shared contract suite for `IOAuthStateStore`, run against
 * `RedisOAuthStateStore` on a real Redis (ADR-0008) and `InMemoryOAuthStateStore`
 * (`constitution.md` → Liskov Substitution).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { InMemoryOAuthStateStore, RedisTestHarness } from '../../testing/index.js';
import type { IOAuthStateStore } from './auth.interface.js';
import { RedisOAuthStateStore } from './oauth-state.store.js';

interface StoreUnderTest {
  readonly store: IOAuthStateStore;
  readonly elapse: (ms: number) => Promise<void>;
}

const VALUE = { codeVerifier: 'v'.repeat(43), nonce: 'n'.repeat(22) };

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

const subjects: readonly { name: string; create: (ttlSec: number) => StoreUnderTest }[] = [
  {
    name: 'RedisOAuthStateStore',
    create: (ttlSec) => ({
      store: new RedisOAuthStateStore(redis.connection, { ttlSec }),
      elapse: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    }),
  },
  {
    name: 'InMemoryOAuthStateStore',
    create: (ttlSec) => {
      let now = Date.UTC(2026, 0, 1);
      return {
        store: new InMemoryOAuthStateStore({ ttlSec }, () => now),
        elapse: (ms) => {
          now += ms;
          return Promise.resolve();
        },
      };
    },
  },
];

describe.each(subjects)('google-sign-in.CT01 — OAuth state store contract — $name', (subject) => {
  it('take() returns what put() stored, once', async () => {
    const { store } = subject.create(600);
    await store.put('state-1', VALUE);

    await expect(store.take('state-1')).resolves.toEqual(VALUE);
    await expect(store.take('state-1')).resolves.toBeNull();
  });

  it('answers null for an unknown state', async () => {
    const { store } = subject.create(600);

    await expect(store.take('never-stored')).resolves.toBeNull();
  });

  it('forgets a state after its TTL', async () => {
    const { store, elapse } = subject.create(1);
    await store.put('state-2', VALUE);

    await elapse(1_100);

    await expect(store.take('state-2')).resolves.toBeNull();
  });
});

describe('RedisOAuthStateStore layout', () => {
  it('stores under auth:google-state:<state> with the TTL, and reads a corrupt value as null', async () => {
    const store = new RedisOAuthStateStore(redis.connection, { ttlSec: 600 });
    await store.put('state-3', VALUE);
    const client = redis.connection.getClient();

    expect(await client.ttl('auth:google-state:state-3')).toBeGreaterThan(595);
    await client.set('auth:google-state:corrupt', 'not json');
    await expect(store.take('corrupt')).resolves.toBeNull();
  });
});
