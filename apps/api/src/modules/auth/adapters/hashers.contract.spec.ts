/**
 * Shared contract suites for the two hashing ports (`constitution.md` → Liskov Substitution):
 * `owner-auth.CT01` — `IPasswordHasher` on `Argon2PasswordHasher` and `FakePasswordHasher`;
 * `owner-auth.CT05` — `IOtpHasher` on `BcryptOtpHasher` and `FakeOtpHasher`.
 * Then the real adapters' own guarantees: the stored formats and bcrypt's input limit.
 */
import { describe, expect, it } from 'vitest';

import { FakeOtpHasher, FakePasswordHasher } from '../../../testing/index.js';
import type { IOtpHasher, IPasswordHasher } from '../auth.interface.js';
import { Argon2PasswordHasher } from './argon2-password-hasher.js';
import { BcryptOtpHasher } from './bcrypt-otp-hasher.js';

const passwordHashers: readonly { name: string; create: () => IPasswordHasher }[] = [
  { name: 'Argon2PasswordHasher', create: () => new Argon2PasswordHasher() },
  { name: 'FakePasswordHasher', create: () => new FakePasswordHasher() },
];

const otpHashers: readonly { name: string; create: () => IOtpHasher }[] = [
  { name: 'BcryptOtpHasher', create: () => new BcryptOtpHasher() },
  { name: 'FakeOtpHasher', create: () => new FakeOtpHasher() },
];

describe.each(passwordHashers)('owner-auth.CT01 — IPasswordHasher contract — $name', ({ create }) => {
  const password = '  correct horse battery staple ü  ';

  it('produces a hash that is not the input', async () => {
    const hash = await create().hash(password);

    expect(hash).not.toBe(password);
    expect(hash).not.toContain(password.trim());
  });

  it('owner-auth.AC1 — verifies the right password', async () => {
    const hasher = create();

    await expect(hasher.verify(await hasher.hash(password), password)).resolves.toBe(true);
  });

  it('owner-auth.AC2 — rejects a wrong password, including one differing only in spacing', async () => {
    const hasher = create();
    const hash = await hasher.hash(password);

    await expect(hasher.verify(hash, 'wrong password')).resolves.toBe(false);
    await expect(hasher.verify(hash, password.trim())).resolves.toBe(false);
  });

  it('salts: two hashes of one password differ, and both verify', async () => {
    const hasher = create();
    const [first, second] = await Promise.all([hasher.hash(password), hasher.hash(password)]);

    expect(first).not.toBe(second);
    await expect(hasher.verify(first, password)).resolves.toBe(true);
    await expect(hasher.verify(second, password)).resolves.toBe(true);
  });

  it('throws on a value that is not one of its hashes', async () => {
    await expect(create().verify('not-a-hash', password)).rejects.toThrow();
  });
});

describe.each(otpHashers)('owner-auth.CT05 — IOtpHasher contract — $name', ({ create }) => {
  it('owner-auth.AC18 — compares the right code true and a wrong one false', async () => {
    const hasher = create();
    const hash = await hasher.hash('042917');

    await expect(hasher.compare('042917', hash)).resolves.toBe(true);
    await expect(hasher.compare('042918', hash)).resolves.toBe(false);
    // Leading zeros are part of the code.
    await expect(hasher.compare('42917', hash)).resolves.toBe(false);
  });

  it('salts: two hashes of one value differ, and both compare true', async () => {
    const hasher = create();
    const identifier = 'f'.repeat(64);
    const [first, second] = await Promise.all([hasher.hash(identifier), hasher.hash(identifier)]);

    expect(first).not.toBe(second);
    await expect(hasher.compare(identifier, first)).resolves.toBe(true);
    await expect(hasher.compare(identifier, second)).resolves.toBe(true);
  });

  it('answers false, never throws, for a malformed hash', async () => {
    await expect(create().compare('123456', 'not-a-hash')).resolves.toBe(false);
  });
});

describe('Argon2PasswordHasher format', () => {
  it('writes argon2id with the pinned cost parameters (PHC order: m, p, t)', async () => {
    const hash = await new Argon2PasswordHasher().hash('any password');

    expect(hash).toMatch(/^\$argon2id\$v=19\$m=65536,p=4,t=3\$/);
  });
});

describe('BcryptOtpHasher format and limits', () => {
  it('writes a cost-10 bcrypt string that fits the reference length limit', async () => {
    const hash = await new BcryptOtpHasher().hash('f'.repeat(64));

    expect(hash).toMatch(/^\$2[aby]\$10\$/);
    // `otpReferenceSchema` accepts at most 100 characters; a bcrypt string is 60.
    expect(hash).toHaveLength(60);
  });

  it('refuses input beyond 72 bytes instead of truncating it', async () => {
    await expect(new BcryptOtpHasher().hash('x'.repeat(73))).rejects.toThrow('72 bytes');
  });
});
