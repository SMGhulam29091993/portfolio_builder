/**
 * Service tests for `PasswordResetService` — request, resend and reset of a one-time code
 * (`owner-auth.UT12`–`UT17`; `AC16`–`AC21`).
 *
 * Every port is a constructor-injected fake that passes the real implementation's contract
 * suite (`owner-auth.CT01`, `CT03`–`CT06`, `CT08`–`CT11`), and time is a `ManualClock`, so
 * expiry and the resend cooldown are reached by moving the clock. No datastore is touched.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import {
  RateLimitedError,
  ServiceUnavailableError,
  UpstreamError,
} from '../../core/errors/index.js';
import {
  FakeOtpHasher,
  FakePasswordHasher,
  InMemoryOtpReferenceStore,
  InMemoryOtpRepository,
  InMemorySessionStore,
  InMemoryUserRepository,
  ManualClock,
  RecordingMailSender,
  SequenceSecureRandom,
} from '../../testing/index.js';
import { DisabledMailSender } from './adapters/disabled-mail-sender.js';
import { OtpExpiredError, OtpInvalidError } from './auth.errors.js';
import type { IMailSender } from './auth.interface.js';
import type { OtpIssuedResponse, User } from './auth.types.js';
import { PasswordResetService } from './password-reset.service.js';

const OWNER_EMAIL = 'owner@example.test';
const OLD_PASSWORD = 'the old password value';
const NEW_PASSWORD = 'a brand new password';
const CODE_TTL_MS = 10 * 60 * 1_000;
const PURGE_MS = 24 * 60 * 60 * 1_000;
const REFERENCE_TTL_SEC = 24 * 60 * 60;
const SESSION_TTL_SEC = 7 * 24 * 60 * 60;

let clock: ManualClock;
let users: InMemoryUserRepository;
let otps: InMemoryOtpRepository;
let references: InMemoryOtpReferenceStore;
let otpHasher: FakeOtpHasher;
let passwords: FakePasswordHasher;
let sessions: InMemorySessionStore;
let mail: RecordingMailSender;
let owner: User;

/** A service over the shared fakes; `mailSender` replaces the recording sender. */
function serviceWith(mailSender: IMailSender = mail): PasswordResetService {
  return new PasswordResetService(
    users,
    users,
    otps,
    references,
    otpHasher,
    passwords,
    sessions,
    mailSender,
    new SequenceSecureRandom(),
    clock,
  );
}

let service: PasswordResetService;

beforeEach(async () => {
  clock = new ManualClock();
  const nowMs = () => clock.now().getTime();
  users = new InMemoryUserRepository(() => clock.now());
  otps = new InMemoryOtpRepository();
  references = new InMemoryOtpReferenceStore({ ttlSec: REFERENCE_TTL_SEC }, nowMs);
  otpHasher = new FakeOtpHasher();
  passwords = new FakePasswordHasher();
  sessions = new InMemorySessionStore({ ttlSec: SESSION_TTL_SEC }, nowMs);
  mail = new RecordingMailSender();
  service = serviceWith();

  owner = await users.create({
    email: OWNER_EMAIL,
    passwordHash: await passwords.hash(OLD_PASSWORD),
    displayName: 'Owner',
  });
});

/** The 6-digit code in the most recent email. */
function lastCode(): string {
  const match = /\b(\d{6})\b/.exec(mail.last?.text ?? '');
  if (!match?.[1]) throw new Error('no code in the last email');
  return match[1];
}

/** The `otps` document a reference currently leads to, or `null`. */
async function recordFor(reference: string) {
  const identifier = await references.resolve(reference);
  return identifier === null ? null : otps.findByIdentifier(identifier);
}

/** A 6-digit code that is not `code`. */
function wrongCode(code: string): string {
  return code === '000000' ? '000001' : '000000';
}

describe('PasswordResetService.requestCode (owner-auth.API05)', () => {
  it('owner-auth.UT12 / AC16 — for the owner: upserts a hashed code expiring in 10 minutes, maps the reference to its identifier and emails the code once', async () => {
    const sentAt = clock.now();

    const issued = await service.requestCode({ email: OWNER_EMAIL });

    expect(issued).toEqual({
      reference: expect.any(String) as string,
      expiresInSec: 600,
    });
    expect(mail.sent).toHaveLength(1);
    expect(mail.last?.to).toBe(OWNER_EMAIL);
    const code = lastCode();
    // The code travels only by email: never in the response.
    expect(JSON.stringify(issued)).not.toContain(code);

    const record = await recordFor(issued.reference);
    expect(record).toEqual({
      id: expect.any(String) as string,
      userId: owner.id,
      purpose: 'password_reset',
      identifier: expect.stringMatching(/^[0-9a-f]{64}$/) as string,
      otpHash: expect.any(String) as string,
      attempts: 0,
      sentAt,
      expiresAt: new Date(sentAt.getTime() + CODE_TTL_MS),
      purgeAt: new Date(sentAt.getTime() + PURGE_MS),
    });
    // Stored hashed, never raw; and the hash is of the emailed code.
    expect(record?.otpHash).not.toContain(code);
    await expect(otpHasher.compare(code, record?.otpHash ?? '')).resolves.toBe(true);
    // The reference is a hash of the identifier, not the identifier itself.
    expect(issued.reference).not.toBe(record?.identifier);
    await expect(otpHasher.compare(record?.identifier ?? '', issued.reference)).resolves.toBe(true);
  });

  it('owner-auth.AC16 — the email is plain text holding the code and its 10-minute expiry, and no link', async () => {
    await service.requestCode({ email: OWNER_EMAIL });

    const text = mail.last?.text ?? '';
    expect(text).toContain(lastCode());
    expect(text).toContain('10 minutes');
    expect(text).not.toMatch(/https?:|www\./i);
  });

  it('owner-auth.UT13 / AC17 — for an unknown email: the same shape, made with the same hashing work, and nothing written or sent', async () => {
    const owners = await service.requestCode({ email: OWNER_EMAIL });
    const ownerHashes = otpHasher.hashCalls;
    otpHasher.hashCalls = 0;
    const freshOtps = otps.size;

    const decoy = await service.requestCode({ email: 'stranger@example.test' });

    expect(Object.keys(decoy).sort()).toEqual(Object.keys(owners).sort());
    expect(decoy.expiresInSec).toBe(owners.expiresInSec);
    expect(decoy.reference).not.toBe(owners.reference);
    expect(otpHasher.hashCalls).toBe(ownerHashes);
    expect(otps.size).toBe(freshOtps);
    await expect(references.resolve(decoy.reference)).resolves.toBeNull();
    expect(mail.sent).toHaveLength(1);
  });

  it('owner-auth.IT24 — a second request replaces the first code; the first reference stops resolving to a document', async () => {
    const first = await service.requestCode({ email: OWNER_EMAIL });
    const second = await service.requestCode({ email: OWNER_EMAIL });

    expect(otps.size).toBe(1);
    await expect(recordFor(first.reference)).resolves.toBeNull();
    await expect(recordFor(second.reference)).resolves.not.toBeNull();
  });

  it('owner-auth.AC22 — with mail disabled outside production, every address gets 503 SERVICE_UNAVAILABLE and nothing is written', async () => {
    const disabled = serviceWith(new DisabledMailSender());

    for (const email of [OWNER_EMAIL, 'stranger@example.test']) {
      await expect(disabled.requestCode({ email })).rejects.toBeInstanceOf(
        ServiceUnavailableError,
      );
    }
    expect(otps.size).toBe(0);
    expect(otpHasher.hashCalls).toBe(0);
  });

  it('owner-auth.API05 — a refused send surfaces as 502 UPSTREAM_FAILED', async () => {
    mail.refuseSends();

    await expect(service.requestCode({ email: OWNER_EMAIL })).rejects.toBeInstanceOf(UpstreamError);
  });
});

describe('PasswordResetService.reset (owner-auth.API07)', () => {
  let issued: OtpIssuedResponse;
  let code: string;

  beforeEach(async () => {
    issued = await service.requestCode({ email: OWNER_EMAIL });
    code = lastCode();
    await sessions.replace(owner.id, {
      jti: 'session-jti',
      refreshTokenHash: 'a'.repeat(64),
      issuedAt: clock.now(),
    });
  });

  it('owner-auth.UT14 / AC18 — the right code in time sets the new password and deletes the code, its reference and the session', async () => {
    const record = await recordFor(issued.reference);
    clock.advance(CODE_TTL_MS - 1);

    await service.reset({
      reference: issued.reference,
      otp: code,
      newPassword: NEW_PASSWORD,
    });

    const updated = await users.findById(owner.id);
    await expect(passwords.verify(updated?.passwordHash ?? '', NEW_PASSWORD)).resolves.toBe(true);
    await expect(passwords.verify(updated?.passwordHash ?? '', OLD_PASSWORD)).resolves.toBe(false);
    expect(updated?.passwordChangedAt).toEqual(clock.now());
    await expect(otps.findByIdentifier(record?.identifier ?? '')).resolves.toBeNull();
    await expect(references.resolve(issued.reference)).resolves.toBeNull();
    await expect(sessions.get(owner.id)).resolves.toBeNull();
  });

  it('owner-auth.AC18 — the same reference sent again is OTP_INVALID', async () => {
    await service.reset({
      reference: issued.reference,
      otp: code,
      newPassword: NEW_PASSWORD,
    });

    await expect(
      service.reset({
        reference: issued.reference,
        otp: code,
        newPassword: NEW_PASSWORD,
      }),
    ).rejects.toBeInstanceOf(OtpInvalidError);
  });

  it('owner-auth.UT15 / AC19 — a wrong code is OTP_INVALID and costs one attempt; after five, the right code is OTP_INVALID without a compare', async () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await expect(
        service.reset({
          reference: issued.reference,
          otp: wrongCode(code),
          newPassword: NEW_PASSWORD,
        }),
      ).rejects.toBeInstanceOf(OtpInvalidError);
      await expect(recordFor(issued.reference)).resolves.toMatchObject({
        attempts: attempt,
      });
    }
    const compares = otpHasher.compareCalls;

    await expect(
      service.reset({
        reference: issued.reference,
        otp: code,
        newPassword: NEW_PASSWORD,
      }),
    ).rejects.toBeInstanceOf(OtpInvalidError);

    expect(otpHasher.compareCalls).toBe(compares);
    // The password did not change.
    const unchanged = await users.findById(owner.id);
    await expect(passwords.verify(unchanged?.passwordHash ?? '', OLD_PASSWORD)).resolves.toBe(true);
  });

  it('owner-auth.AC19 — guesses sent in parallel cannot get more than five compares between them', async () => {
    const guesses = Array.from({ length: 20 }, (_, index) =>
      service.reset({
        reference: issued.reference,
        otp: String(index).padStart(6, '9'),
        newPassword: NEW_PASSWORD,
      }),
    );

    const outcomes = await Promise.allSettled(guesses);

    expect(outcomes.every((outcome) => outcome.status === 'rejected')).toBe(true);
    // Each guess claims its attempt before comparing, so the five-attempt limit holds even
    // when every guess read `attempts` before any of them failed.
    expect(otpHasher.compareCalls).toBeLessThanOrEqual(5);
  });

  it('owner-auth.UT16 / AC20 — after expiresAt the code is OTP_EXPIRED and nothing is deleted or counted', async () => {
    clock.advance(CODE_TTL_MS);

    await expect(
      service.reset({
        reference: issued.reference,
        otp: code,
        newPassword: NEW_PASSWORD,
      }),
    ).rejects.toBeInstanceOf(OtpExpiredError);

    await expect(recordFor(issued.reference)).resolves.toMatchObject({
      attempts: 0,
    });
    await expect(sessions.get(owner.id)).resolves.not.toBeNull();
  });

  it('owner-auth.API07 — an unknown reference is OTP_INVALID', async () => {
    await expect(
      service.reset({
        reference: 'never-issued',
        otp: code,
        newPassword: NEW_PASSWORD,
      }),
    ).rejects.toBeInstanceOf(OtpInvalidError);
  });

  it('owner-auth.AC17 — a decoy reference is OTP_INVALID', async () => {
    const decoy = await service.requestCode({ email: 'stranger@example.test' });

    await expect(
      service.reset({
        reference: decoy.reference,
        otp: code,
        newPassword: NEW_PASSWORD,
      }),
    ).rejects.toBeInstanceOf(OtpInvalidError);
  });
});

describe('PasswordResetService.resend (owner-auth.API06)', () => {
  let issued: OtpIssuedResponse;
  let code: string;

  beforeEach(async () => {
    issued = await service.requestCode({ email: OWNER_EMAIL });
    code = lastCode();
  });

  it('owner-auth.UT17 / AC21 — at 59 s it is RATE_LIMITED with the seconds left, and nothing changes', async () => {
    clock.advance(59_000);

    const refused = service.resend({ reference: issued.reference });

    await expect(refused).rejects.toBeInstanceOf(RateLimitedError);
    await expect(refused).rejects.toMatchObject({
      details: { retryAfterSec: 1 },
    });
    expect(mail.sent).toHaveLength(1);
    await expect(recordFor(issued.reference)).resolves.not.toBeNull();
  });

  it('owner-auth.UT17 / AC21 — at 61 s it issues a new code, identifier and reference with attempts 0; the old reference and the old code are dead', async () => {
    await expect(
      service.reset({
        reference: issued.reference,
        otp: wrongCode(code),
        newPassword: NEW_PASSWORD,
      }),
    ).rejects.toBeInstanceOf(OtpInvalidError);
    const before = await recordFor(issued.reference);
    clock.advance(61_000);

    const resent = await service.resend({ reference: issued.reference });

    expect(resent).toEqual({
      reference: expect.any(String) as string,
      expiresInSec: 600,
    });
    expect(resent.reference).not.toBe(issued.reference);
    expect(mail.sent).toHaveLength(2);
    expect(mail.last?.to).toBe(OWNER_EMAIL);
    const after = await recordFor(resent.reference);
    expect(after).toMatchObject({
      id: before?.id,
      attempts: 0,
      sentAt: clock.now(),
      expiresAt: new Date(clock.now().getTime() + CODE_TTL_MS),
    });
    expect(after?.identifier).not.toBe(before?.identifier);
    await expect(references.resolve(issued.reference)).resolves.toBeNull();

    // The old code no longer verifies against the new reference.
    const newCode = lastCode();
    if (newCode !== code) {
      await expect(
        service.reset({
          reference: resent.reference,
          otp: code,
          newPassword: NEW_PASSWORD,
        }),
      ).rejects.toBeInstanceOf(OtpInvalidError);
    }
    await expect(
      service.reset({
        reference: issued.reference,
        otp: newCode,
        newPassword: NEW_PASSWORD,
      }),
    ).rejects.toBeInstanceOf(OtpInvalidError);
    await service.reset({
      reference: resent.reference,
      otp: newCode,
      newPassword: NEW_PASSWORD,
    });
  });

  it('owner-auth.AC21 — an expired code can still be resent by its reference', async () => {
    clock.advance(CODE_TTL_MS + 1);

    await expect(service.resend({ reference: issued.reference })).resolves.toMatchObject({
      expiresInSec: 600,
    });
  });

  it('owner-auth.API06 — a reference that resolves to nothing is OTP_INVALID', async () => {
    await expect(service.resend({ reference: 'never-issued' })).rejects.toBeInstanceOf(
      OtpInvalidError,
    );
    const replaced = await service.requestCode({ email: OWNER_EMAIL });
    expect(replaced.reference).not.toBe(issued.reference);
    clock.advance(61_000);
    // Superseded by the second request: the identifier no longer has a document.
    await expect(service.resend({ reference: issued.reference })).rejects.toBeInstanceOf(
      OtpInvalidError,
    );
  });

  it('owner-auth.AC22 — with mail disabled outside production, a resend is 503 SERVICE_UNAVAILABLE', async () => {
    clock.advance(61_000);

    await expect(
      serviceWith(new DisabledMailSender()).resend({
        reference: issued.reference,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableError);
  });
});
