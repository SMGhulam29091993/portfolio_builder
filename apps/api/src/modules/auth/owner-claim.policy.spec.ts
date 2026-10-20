/** `OwnerClaimPolicy` — `account-registration.UT01` (AC4, AC5). */
import { describe, expect, it } from 'vitest';

import { InMemoryUserRepository, NewUserFactory } from '../../testing/index.js';
import { OwnerClaimRefusedError } from './auth.errors.js';
import { OwnerClaimPolicy } from './owner-claim.policy.js';

const SECRET = 'a-configured-owner-secret-of-32-chars!';

async function policy(options: { secret?: string; ownerExists?: boolean }) {
  const users = new InMemoryUserRepository();
  if (options.ownerExists) await users.create(new NewUserFactory().build({ role: 'owner' }));
  return new OwnerClaimPolicy(users, { secret: options.secret });
}

describe('OwnerClaimPolicy (account-registration.UT01)', () => {
  it('is open with a secret and no owner; closed otherwise', async () => {
    await expect((await policy({ secret: SECRET })).isOpen()).resolves.toBe(true);
    await expect((await policy({ secret: SECRET, ownerExists: true })).isOpen()).resolves.toBe(
      false,
    );
    await expect((await policy({})).isOpen()).resolves.toBe(false);
  });

  it('gives member when no secret is sent, whatever the claim state', async () => {
    await expect((await policy({ secret: SECRET })).decide(undefined)).resolves.toBe('member');
    await expect((await policy({ ownerExists: true })).decide(undefined)).resolves.toBe('member');
  });

  it('account-registration.AC4 — gives owner for the matching secret while open', async () => {
    await expect((await policy({ secret: SECRET })).decide(SECRET)).resolves.toBe('owner');
  });

  it.each([
    ['a wrong value', { secret: SECRET }, 'not-the-secret'],
    ['an existing owner, even with the right value', { secret: SECRET, ownerExists: true }, SECRET],
    ['no configured secret', {}, SECRET],
    ['no configured secret and an empty-looking value', {}, ' '],
  ])('account-registration.AC5 — refuses on %s', async (_case, options, given) => {
    await expect((await policy(options)).decide(given)).rejects.toBeInstanceOf(
      OwnerClaimRefusedError,
    );
  });
});
