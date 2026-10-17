/**
 * Repository tests for `otps` against a real `mongod` (`constitution.md` → Per-layer
 * convention). Behaviour that depends on the clock — expiry, cooldown — belongs to
 * `PasswordResetService` (`owner-auth.T08`); this file covers storage only.
 */
import { Types } from 'mongoose';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { MongoTestHarness, OtpIssueFactory } from '../../testing/index.js';
import { otpModel } from './otp.model.js';
import { OtpRepository } from './otp.repository.js';

let mongo: MongoTestHarness;
let otps: OtpRepository;
const issues = new OtpIssueFactory();

beforeAll(async () => {
  mongo = await MongoTestHarness.start();
  otps = new OtpRepository(mongo.connection);
  await otpModel(mongo.connection.getConnection()).init();
});

afterEach(async () => {
  await mongo.reset();
});

afterAll(async () => {
  await mongo.stop();
});

/** Number of documents in `otps`. */
function countOtps(): Promise<number> {
  return otpModel(mongo.connection.getConnection()).countDocuments().exec();
}

describe('OtpRepository', () => {
  it('owner-auth.AC16 — upsert() inserts the first code with attempts 0', async () => {
    const issue = issues.build();

    const stored = await otps.upsert(issue);

    expect(stored).toEqual({ id: expect.any(String) as string, attempts: 0, ...issue });
    expect(await countOtps()).toBe(1);
  });

  it('owner-auth.IT24 — upsert() for the same user and purpose overwrites: one document, attempts reset', async () => {
    const userId = new Types.ObjectId().toString();
    const first = await otps.upsert(issues.build({ userId }));
    await otps.incrementAttempts(first.id);
    const second = issues.build({ userId });

    const stored = await otps.upsert(second);

    expect(stored).toEqual({ id: first.id, attempts: 0, ...second });
    expect(await countOtps()).toBe(1);
    // The earlier identifier no longer resolves, so its reference is dead (spec → Edge Cases).
    await expect(otps.findByIdentifier(first.identifier)).resolves.toBeNull();
  });

  it('keeps one document per user', async () => {
    await otps.upsert(issues.build());
    await otps.upsert(issues.build());

    expect(await countOtps()).toBe(2);
  });

  it('findByIdentifier() finds the document, or null', async () => {
    const stored = await otps.upsert(issues.build());

    await expect(otps.findByIdentifier(stored.identifier)).resolves.toEqual(stored);
    await expect(otps.findByIdentifier('0'.repeat(64))).resolves.toBeNull();
  });

  it('owner-auth.AC19 — incrementAttempts() counts every wrong code, even when they arrive together', async () => {
    const stored = await otps.upsert(issues.build());

    const counts = await Promise.all(
      Array.from({ length: 5 }, () => otps.incrementAttempts(stored.id)),
    );

    expect([...counts].sort()).toEqual([1, 2, 3, 4, 5]);
    await expect(otps.findByIdentifier(stored.identifier)).resolves.toMatchObject({ attempts: 5 });
  });

  it('incrementAttempts() answers null for a missing or malformed id', async () => {
    await expect(otps.incrementAttempts(new Types.ObjectId().toString())).resolves.toBeNull();
    await expect(otps.incrementAttempts('nope')).resolves.toBeNull();
  });

  it('owner-auth.AC18 — deleteById() removes the document and tolerates a missing one', async () => {
    const stored = await otps.upsert(issues.build());

    await otps.deleteById(stored.id);
    await otps.deleteById(stored.id);
    await otps.deleteById('nope');

    expect(await countOtps()).toBe(0);
  });

  it('rejects a purpose outside the allowed list', async () => {
    const issue = { ...issues.build(), purpose: 'email_change' } as unknown as Parameters<
      OtpRepository['upsert']
    >[0];

    await expect(otps.upsert(issue)).rejects.toThrow();
  });

  it('owner-auth.IT25 — declares the TTL, upsert-key and identifier indexes', async () => {
    const indexes = await otpModel(mongo.connection.getConnection()).listIndexes();

    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: { purgeAt: 1 }, expireAfterSeconds: 0 }),
        expect.objectContaining({ key: { userId: 1, purpose: 1 }, unique: true }),
        expect.objectContaining({ key: { identifier: 1 }, unique: true }),
      ]),
    );
  });
});
