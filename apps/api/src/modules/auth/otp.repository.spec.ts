/**
 * Repository tests for `otps` against a real `mongod` (`constitution.md` → Per-layer
 * convention): only what MongoDB alone has — the stored document count, the schema's `purpose`
 * enum and the indexes. The behaviour every `IOtpRepository` shares is in
 * `otp-repository.contract.spec.ts` (`owner-auth.CT11`); expiry, cooldown and attempts limits
 * belong to `PasswordResetService` (`owner-auth.T08`).
 */
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
  it('owner-auth.IT24 — a second upsert for one user leaves exactly one document', async () => {
    const issue = issues.build();
    await otps.upsert(issue);
    await otps.upsert(issues.build({ userId: issue.userId }));

    expect(await countOtps()).toBe(1);
  });

  it('owner-auth.AC18 — deleteById() leaves no document behind', async () => {
    const stored = await otps.upsert(issues.build());

    await otps.deleteById(stored.id);

    expect(await countOtps()).toBe(0);
  });

  it('rejects a purpose outside the allowed list', async () => {
    const issue = {
      ...issues.build(),
      purpose: 'email_change',
    } as unknown as Parameters<OtpRepository['upsert']>[0];

    await expect(otps.upsert(issue)).rejects.toThrow();
  });

  it('owner-auth.IT25 — declares the TTL, upsert-key and identifier indexes', async () => {
    const indexes = await otpModel(mongo.connection.getConnection()).listIndexes();

    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: { purgeAt: 1 }, expireAfterSeconds: 0 }),
        expect.objectContaining({
          key: { userId: 1, purpose: 1 },
          unique: true,
        }),
        expect.objectContaining({ key: { identifier: 1 }, unique: true }),
      ]),
    );
  });
});
