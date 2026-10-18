/**
 * `owner-auth.CT11` — shared contract suite for `IOtpRepository`, run against `OtpRepository` on
 * a real `mongod` and against `InMemoryOtpRepository`, the fake `PasswordResetService` is tested
 * with (`constitution.md` → Liskov Substitution). Checks only MongoDB has — the indexes and the
 * schema's `purpose` enum — stay in `otp.repository.spec.ts`.
 */
import { Types } from 'mongoose';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { InMemoryOtpRepository, MongoTestHarness, OtpIssueFactory } from '../../testing/index.js';
import type { IOtpRepository } from './auth.interface.js';
import { otpModel } from './otp.model.js';
import { OtpRepository } from './otp.repository.js';

interface ContractSubject {
  readonly name: string;
  readonly create: () => IOtpRepository;
}

let mongo: MongoTestHarness;

beforeAll(async () => {
  mongo = await MongoTestHarness.start();
  // Wait for the index build, so the one-document-per-user cases cannot race it.
  await otpModel(mongo.connection.getConnection()).init();
});

afterEach(async () => {
  await mongo.reset();
});

afterAll(async () => {
  await mongo.stop();
});

const subjects: readonly ContractSubject[] = [
  { name: 'OtpRepository', create: () => new OtpRepository(mongo.connection) },
  { name: 'InMemoryOtpRepository', create: () => new InMemoryOtpRepository() },
];

describe.each(subjects)('owner-auth.CT11 — IOtpRepository contract — $name', (subject) => {
  const issues = new OtpIssueFactory();

  it('owner-auth.AC16 — upsert() inserts the first code with attempts 0', async () => {
    const otps = subject.create();
    const issue = issues.build();

    const stored = await otps.upsert(issue);

    expect(stored).toEqual({
      id: expect.any(String) as string,
      attempts: 0,
      ...issue,
    });
    expect(Types.ObjectId.isValid(stored.id)).toBe(true);
  });

  it('owner-auth.IT24 — upsert() for the same user and purpose overwrites in place and resets attempts', async () => {
    const otps = subject.create();
    const userId = new Types.ObjectId().toString();
    const first = await otps.upsert(issues.build({ userId }));
    await otps.incrementAttempts(first.id);
    const second = issues.build({ userId });

    const stored = await otps.upsert(second);

    expect(stored).toEqual({ id: first.id, attempts: 0, ...second });
    // The earlier identifier no longer resolves, so its reference is dead (spec → Edge Cases).
    await expect(otps.findByIdentifier(first.identifier)).resolves.toBeNull();
    await expect(otps.findByIdentifier(second.identifier)).resolves.toEqual(stored);
  });

  it('keeps one document per user', async () => {
    const otps = subject.create();
    const first = await otps.upsert(issues.build());
    const second = await otps.upsert(issues.build());

    expect(second.id).not.toBe(first.id);
    await expect(otps.findByIdentifier(first.identifier)).resolves.toEqual(first);
    await expect(otps.findByIdentifier(second.identifier)).resolves.toEqual(second);
  });

  it('findByIdentifier() answers null for an identifier no document holds', async () => {
    const otps = subject.create();
    await otps.upsert(issues.build());

    await expect(otps.findByIdentifier('0'.repeat(64))).resolves.toBeNull();
  });

  it('owner-auth.AC19 — incrementAttempts() counts every wrong code, even when they arrive together', async () => {
    const otps = subject.create();
    const stored = await otps.upsert(issues.build());

    const counts = await Promise.all(
      Array.from({ length: 5 }, () => otps.incrementAttempts(stored.id)),
    );

    expect([...counts].sort()).toEqual([1, 2, 3, 4, 5]);
    await expect(otps.findByIdentifier(stored.identifier)).resolves.toMatchObject({ attempts: 5 });
  });

  it('incrementAttempts() answers null for a missing or malformed id', async () => {
    const otps = subject.create();

    await expect(otps.incrementAttempts(new Types.ObjectId().toString())).resolves.toBeNull();
    await expect(otps.incrementAttempts('nope')).resolves.toBeNull();
  });

  it('owner-auth.AC18 — deleteById() removes the document and tolerates a missing one', async () => {
    const otps = subject.create();
    const stored = await otps.upsert(issues.build());

    await otps.deleteById(stored.id);
    await otps.deleteById(stored.id);
    await otps.deleteById('nope');

    await expect(otps.findByIdentifier(stored.identifier)).resolves.toBeNull();
    await expect(otps.incrementAttempts(stored.id)).resolves.toBeNull();
  });
});
