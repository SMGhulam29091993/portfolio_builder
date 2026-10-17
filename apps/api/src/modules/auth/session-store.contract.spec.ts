/**
 * `owner-auth.CT03` — shared contract suite for `ISessionStore`, run against `RedisSessionStore`
 * on a real Redis (ADR-0008) and against `InMemorySessionStore`, the fake service tests use
 * (`constitution.md` → Liskov Substitution). Then Redis-only checks of the stored layout.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  AuthSessionFactory,
  InMemorySessionStore,
  RedisTestHarness,
} from '../../testing/index.js';
import type { ISessionStore } from './auth.interface.js';
import { RedisSessionStore } from './session.store.js';

/** A store under test plus a way to let time pass for it. */
interface StoreUnderTest {
  readonly store: ISessionStore;
  /** Lets `ms` pass: real time for Redis, a moved clock for the fake. */
  readonly elapse: (ms: number) => Promise<void>;
}

interface ContractSubject {
  readonly name: string;
  readonly create: (ttlSec: number) => StoreUnderTest;
}

/** The spec's session lifetime: 7 days. */
const SESSION_TTL_SEC = 7 * 24 * 60 * 60;

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
    name: 'RedisSessionStore',
    create: (ttlSec) => ({
      store: new RedisSessionStore(redis.connection, { ttlSec }),
      elapse: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    }),
  },
  {
    name: 'InMemorySessionStore',
    create: (ttlSec) => {
      let now = Date.UTC(2026, 0, 1);
      return {
        store: new InMemorySessionStore({ ttlSec }, () => now),
        elapse: (ms) => {
          now += ms;
          return Promise.resolve();
        },
      };
    },
  },
];

describe.each(subjects)('owner-auth.CT03 — ISessionStore contract — $name', (subject) => {
  const sessions = new AuthSessionFactory();
  const userId = 'user-1';

  it('answers null when the user has no session', async () => {
    const { store } = subject.create(SESSION_TTL_SEC);

    await expect(store.get(userId)).resolves.toBeNull();
  });

  it('owner-auth.AC1 — returns exactly what replace() stored', async () => {
    const { store } = subject.create(SESSION_TTL_SEC);
    const session = sessions.build();

    await store.replace(userId, session);

    await expect(store.get(userId)).resolves.toEqual(session);
  });

  it('owner-auth.AC7 — replace() overwrites the previous session: one session per user', async () => {
    const { store } = subject.create(SESSION_TTL_SEC);
    await store.replace(userId, sessions.build());
    const newer = sessions.build();

    await store.replace(userId, newer);

    await expect(store.get(userId)).resolves.toEqual(newer);
  });

  it('keeps sessions of different users apart', async () => {
    const { store } = subject.create(SESSION_TTL_SEC);
    const first = sessions.build();
    const second = sessions.build();

    await store.replace('user-a', first);
    await store.replace('user-b', second);

    await expect(store.get('user-a')).resolves.toEqual(first);
    await expect(store.get('user-b')).resolves.toEqual(second);
  });

  it('owner-auth.AC8 — compareAndSet() swaps when the jti matches', async () => {
    const { store } = subject.create(SESSION_TTL_SEC);
    const current = sessions.build();
    const next = sessions.build();
    await store.replace(userId, current);

    await expect(store.compareAndSet(userId, current.jti, next)).resolves.toBe(true);

    await expect(store.get(userId)).resolves.toEqual(next);
  });

  it('owner-auth.AC6 — compareAndSet() refuses a stale jti and leaves the session unchanged', async () => {
    const { store } = subject.create(SESSION_TTL_SEC);
    const current = sessions.build();
    await store.replace(userId, current);

    await expect(store.compareAndSet(userId, 'jti-stale', sessions.build())).resolves.toBe(false);

    await expect(store.get(userId)).resolves.toEqual(current);
  });

  it('compareAndSet() refuses when there is no session, and creates none', async () => {
    const { store } = subject.create(SESSION_TTL_SEC);

    await expect(store.compareAndSet(userId, 'jti-any', sessions.build())).resolves.toBe(false);

    await expect(store.get(userId)).resolves.toBeNull();
  });

  it('owner-auth.AC10 — of many concurrent compareAndSet() calls with one jti, exactly one wins', async () => {
    const { store } = subject.create(SESSION_TTL_SEC);
    const current = sessions.build();
    await store.replace(userId, current);
    const candidates = sessions.buildList(20);

    const results = await Promise.all(
      candidates.map((next) => store.compareAndSet(userId, current.jti, next)),
    );

    expect(results.filter(Boolean)).toHaveLength(1);
    const winner = candidates[results.indexOf(true)];
    await expect(store.get(userId)).resolves.toEqual(winner);
  });

  it('owner-auth.AC11 — deleteIfJti() deletes only the session holding that jti', async () => {
    const { store } = subject.create(SESSION_TTL_SEC);
    const current = sessions.build();
    await store.replace(userId, current);

    await expect(store.deleteIfJti(userId, 'jti-superseded')).resolves.toBe(false);
    await expect(store.get(userId)).resolves.toEqual(current);

    await expect(store.deleteIfJti(userId, current.jti)).resolves.toBe(true);
    await expect(store.get(userId)).resolves.toBeNull();
    await expect(store.deleteIfJti(userId, current.jti)).resolves.toBe(false);
  });

  it('owner-auth.AC18 — delete() removes the session whatever its jti, and tolerates none', async () => {
    const { store } = subject.create(SESSION_TTL_SEC);
    await store.replace(userId, sessions.build());

    await store.delete(userId);
    await store.delete(userId);

    await expect(store.get(userId)).resolves.toBeNull();
  });

  it('owner-auth.IT11 (Edge) — a session expires after the TTL', async () => {
    const { store, elapse } = subject.create(1);
    await store.replace(userId, sessions.build());

    await elapse(1_200);

    await expect(store.get(userId)).resolves.toBeNull();
  });

  it('owner-auth.AC8 — compareAndSet() resets the TTL (sessions slide)', async () => {
    const { store, elapse } = subject.create(2);
    const current = sessions.build();
    const next = sessions.build();
    await store.replace(userId, current);

    await elapse(1_200);
    await store.compareAndSet(userId, current.jti, next);
    await elapse(1_200);

    // 2.4 s after the first write, past its TTL, but 1.2 s after the swap.
    await expect(store.get(userId)).resolves.toEqual(next);
  });
});

describe('RedisSessionStore layout (ADR-0008)', () => {
  it('stores one hash at auth:session:<userId> with the configured TTL', async () => {
    const store = new RedisSessionStore(redis.connection, { ttlSec: SESSION_TTL_SEC });
    const session = new AuthSessionFactory().build();

    await store.replace('user-1', session);

    const client = redis.connection.getClient();
    await expect(client.type('auth:session:user-1')).resolves.toBe('hash');
    await expect(client.hGetAll('auth:session:user-1')).resolves.toEqual({
      jti: session.jti,
      refreshTokenHash: session.refreshTokenHash,
      issuedAt: String(session.issuedAt.getTime()),
    });
    const ttl = await client.ttl('auth:session:user-1');
    expect(ttl).toBeGreaterThan(SESSION_TTL_SEC - 5);
    expect(ttl).toBeLessThanOrEqual(SESSION_TTL_SEC);
  });

  it('treats a partial hash as no session', async () => {
    const store = new RedisSessionStore(redis.connection, { ttlSec: SESSION_TTL_SEC });
    await redis.connection.getClient().hSet('auth:session:user-1', { jti: 'jti-only' });

    await expect(store.get('user-1')).resolves.toBeNull();
  });
});
