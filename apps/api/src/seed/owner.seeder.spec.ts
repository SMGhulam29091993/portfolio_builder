/**
 * Unit tests for `OwnerSeeder` with constructor-injected fakes (`constitution.md` → Per-layer
 * convention). The real repository, argon2id and the `seed:owner` script are proven end to end
 * in `seed-owner.spec.ts` (`owner-auth.IT14`, `IT26`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FakePasswordHasher, InMemoryUserRepository } from '../testing/index.js';
import { DEV_OWNER } from './data/owner.js';
import { OwnerSeeder, type OwnerSeederEnv } from './owner.seeder.js';
import { SeedConfigurationError, SeedRefusedError } from './seed.errors.js';

/** A valid non-production configuration; each case overrides what it is about. */
const VALID_ENV: OwnerSeederEnv = {
  NODE_ENV: 'development',
  OWNER_EMAIL: 'Owner@Portfolio.TEST',
  OWNER_PASSWORD: 'correct horse battery',
};

/** Builds a seeder over fresh fakes, returned with it so a case can inspect them. */
function seederWith(env: Partial<OwnerSeederEnv> = {}) {
  const users = new InMemoryUserRepository();
  const hasher = new FakePasswordHasher();
  const seeder = new OwnerSeeder(users, users, hasher, { ...VALID_ENV, ...env });
  return { seeder, users, hasher };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OwnerSeeder', () => {
  it('owner-auth.AC13 — creates one user with the hashed password and the default display name', async () => {
    const { seeder, users, hasher } = seederWith();

    await expect(seeder.run()).resolves.toBe('created');

    const created = await users.findByEmail('owner@portfolio.test');
    expect(created).toMatchObject({
      email: 'owner@portfolio.test',
      displayName: DEV_OWNER.displayName,
    });
    // Stored as a hash of the configured password, never the password itself.
    expect(created?.passwordHash).not.toContain(VALID_ENV.OWNER_PASSWORD);
    await expect(
      hasher.verify(created?.passwordHash ?? '', VALID_ENV.OWNER_PASSWORD ?? ''),
    ).resolves.toBe(true);
  });

  it('owner-auth.AC13 — a second run changes nothing and hashes nothing', async () => {
    const { seeder, users, hasher } = seederWith();
    await seeder.run();
    const before = await users.findByEmail(VALID_ENV.OWNER_EMAIL ?? '');
    const hash = vi.spyOn(hasher, 'hash');
    const create = vi.spyOn(users, 'create');

    await expect(seeder.run()).resolves.toBe('unchanged');

    expect(await users.findByEmail(VALID_ENV.OWNER_EMAIL ?? '')).toEqual(before);
    expect(hash).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('owner-auth.AC13 — leaves an existing account alone, whatever password is configured now', async () => {
    const { seeder, users } = seederWith();
    await seeder.run();
    const before = await users.findByEmail(VALID_ENV.OWNER_EMAIL ?? '');

    const rerun = new OwnerSeeder(users, users, new FakePasswordHasher(), {
      ...VALID_ENV,
      OWNER_PASSWORD: 'a different long password',
    });

    await expect(rerun.run()).resolves.toBe('unchanged');
    expect((await users.findByEmail(VALID_ENV.OWNER_EMAIL ?? ''))?.passwordHash).toBe(
      before?.passwordHash,
    );
  });

  it('owner-auth.AC13 — a run that loses the race to a concurrent one reports unchanged', async () => {
    const { seeder, users } = seederWith();
    await seeder.run();
    // The other run created the account between this run's lookup and its insert.
    vi.spyOn(users, 'findByEmail').mockResolvedValueOnce(null);

    await expect(seeder.run()).resolves.toBe('unchanged');
  });

  it.each([
    ['an 11-character password', 'elevenchars'],
    ['no password', undefined],
  ])(
    'owner-auth.UT11 — refuses %s, naming OWNER_PASSWORD without echoing it',
    async (_case, password) => {
      const { seeder, users } = seederWith({ OWNER_PASSWORD: password });
      const create = vi.spyOn(users, 'create');

      const error = await seeder.run().catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(SeedConfigurationError);
      expect((error as SeedConfigurationError).variable).toBe('OWNER_PASSWORD');
      expect((error as Error).message).toContain('OWNER_PASSWORD');
      if (password) expect((error as Error).message).not.toContain(password);
      expect(create).not.toHaveBeenCalled();
    },
  );

  it('owner-auth.AC14 — accepts a password of exactly 12 characters (boundary)', async () => {
    const { seeder } = seederWith({ OWNER_PASSWORD: 'twelve-chars' });

    await expect(seeder.run()).resolves.toBe('created');
  });

  it('owner-auth.AC14 — refuses a password longer than sign-in accepts, without echoing it', async () => {
    // A longer password could be stored but never typed into the login form (API01).
    const password = 'p'.repeat(201);
    const { seeder, users } = seederWith({ OWNER_PASSWORD: password });
    const create = vi.spyOn(users, 'create');

    const error = await seeder.run().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(SeedConfigurationError);
    expect((error as SeedConfigurationError).variable).toBe('OWNER_PASSWORD');
    expect((error as Error).message).not.toContain(password);
    expect(create).not.toHaveBeenCalled();
  });

  it('owner-auth.AC14 — refuses a missing OWNER_EMAIL, naming it, and reads nothing', async () => {
    const { seeder, users } = seederWith({ OWNER_EMAIL: undefined });
    const find = vi.spyOn(users, 'findByEmail');

    const error = await seeder.run().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(SeedConfigurationError);
    expect((error as SeedConfigurationError).variable).toBe('OWNER_EMAIL');
    expect(find).not.toHaveBeenCalled();
  });

  it('owner-auth.UT19 — refuses in production before reading, hashing or creating anything', async () => {
    const { seeder, users, hasher } = seederWith({ NODE_ENV: 'production' });
    const find = vi.spyOn(users, 'findByEmail');
    const create = vi.spyOn(users, 'create');
    const hash = vi.spyOn(hasher, 'hash');

    const error = await seeder.run().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(SeedRefusedError);
    // Names neither the email nor the password.
    expect((error as Error).message).not.toContain(VALID_ENV.OWNER_EMAIL);
    expect((error as Error).message).not.toContain(VALID_ENV.OWNER_PASSWORD);
    expect(find).not.toHaveBeenCalled();
    expect(hash).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('owner-auth.UT19 — refuses in production even with the variables missing', async () => {
    // The production refusal comes first, so it is the error a misconfigured production
    // deploy sees — not a hint about which variable to set.
    const { seeder } = seederWith({
      NODE_ENV: 'production',
      OWNER_EMAIL: undefined,
      OWNER_PASSWORD: undefined,
    });

    await expect(seeder.run()).rejects.toBeInstanceOf(SeedRefusedError);
  });
});
