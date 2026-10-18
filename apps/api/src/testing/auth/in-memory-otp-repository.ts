/**
 * In-memory fake of `OtpRepository`, for `PasswordResetService` tests (`constitution.md` →
 * Per-layer convention: services get constructor-injected fakes).
 *
 * It passes the same contract suite as the MongoDB repository
 * (`modules/auth/otp-repository.contract.spec.ts`, `owner-auth.CT11`), so a service test using
 * it proves what the real repository would do. Like the real one it keeps one document per
 * `(userId, purpose)`, keeps the id across an overwrite and resets `attempts` on every upsert.
 * The `purgeAt` TTL is MongoDB's job and is not imitated: no service test runs for 24 hours.
 */
import { Types } from 'mongoose';

import type { IOtpRepository, OtpIssue, OtpRecord } from '../../modules/auth/index.js';

export class InMemoryOtpRepository implements IOtpRepository {
  /** Documents by id. */
  private readonly records = new Map<string, OtpRecord>();

  upsert(issue: OtpIssue): Promise<OtpRecord> {
    const key = upsertKey(issue);
    const existing = [...this.records.values()].find((record) => upsertKey(record) === key);
    // An ObjectId string, so ids have the shape the real repository returns.
    const stored: OtpRecord = {
      id: existing?.id ?? new Types.ObjectId().toString(),
      attempts: 0,
      ...issue,
    };
    this.records.set(stored.id, stored);
    return Promise.resolve(stored);
  }

  findByIdentifier(identifier: string): Promise<OtpRecord | null> {
    const found = [...this.records.values()].find((record) => record.identifier === identifier);
    return Promise.resolve(found ?? null);
  }

  incrementAttempts(id: string): Promise<number | null> {
    const record = this.records.get(id);
    if (!record) return Promise.resolve(null);
    const attempts = record.attempts + 1;
    this.records.set(id, { ...record, attempts });
    return Promise.resolve(attempts);
  }

  deleteById(id: string): Promise<void> {
    this.records.delete(id);
    return Promise.resolve();
  }

  /** How many documents are stored; lets a test prove nothing was written (`owner-auth.UT13`). */
  get size(): number {
    return this.records.size;
  }
}

/**
 * The upsert key, `(userId, purpose)`, as one string — the fake's copy of the unique compound
 * index. Compared whole, so it stays right when a second purpose is added.
 */
function upsertKey({ userId, purpose }: Pick<OtpRecord, 'userId' | 'purpose'>): string {
  return `${userId} ${purpose}`;
}
