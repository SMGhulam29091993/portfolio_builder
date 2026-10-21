/**
 * Service tests for `RegistrationService` (`account-registration.UT03`–`UT05`; AC1–AC5,
 * AC7, AC8, AC10–AC12). Every port is an in-memory fake that passes its real implementation's
 * contract suite; time is a `ManualClock`. No datastore is touched.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { RateLimitedError, ServiceUnavailableError } from '../../core/errors/index.js';
import {
  FakeOtpHasher,
  FakePasswordHasher,
  InMemoryOtpReferenceStore,
  InMemoryOtpRepository,
  InMemoryUserRepository,
  ManualClock,
  RecordingMailSender,
  SequenceSecureRandom,
} from '../../testing/index.js';
import { DisabledMailSender } from './adapters/disabled-mail-sender.js';
import { DisabledOidcProvider } from './adapters/oidc-provider.js';
import { OtpExpiredError, OtpInvalidError, OwnerClaimRefusedError } from './auth.errors.js';
import type { IMailSender, ISessionStarter } from './auth.interface.js';
import type { RegisterRequest, SignedInSession, User } from './auth.types.js';
import { OwnerClaimPolicy } from './owner-claim.policy.js';
import { RegistrationService } from './registration.service.js';

const SECRET = 'the-owner-registration-secret-0123456789';
const EMAIL = 'new.user@example.test';
const REQUEST: RegisterRequest = {
  email: EMAIL,
  password: 'a long enough password',
  displayName: 'Ann',
};

/** Records which users a session was started for; returns a fixed token set. */
class RecordingSessionStarter implements ISessionStarter {
  readonly startedFor: User[] = [];

  startFor(user: User): Promise<SignedInSession> {
    this.startedFor.push(user);
    return Promise.resolve({
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
      tokens: { accessToken: 'a', refreshToken: 'r', jti: 'j' },
    });
  }
}

let clock: ManualClock;
let users: InMemoryUserRepository;
let otps: InMemoryOtpRepository;
let references: InMemoryOtpReferenceStore;
let otpHasher: FakeOtpHasher;
let passwords: FakePasswordHasher;
let mail: RecordingMailSender;
let sessions: RecordingSessionStarter;
let service: RegistrationService;

function serviceWith(
  options: { secret?: string; mailSender?: IMailSender } = { secret: SECRET },
): RegistrationService {
  return new RegistrationService(
    users,
    users,
    users,
    otps,
    references,
    otpHasher,
    passwords,
    options.mailSender ?? mail,
    new SequenceSecureRandom(),
    clock,
    new OwnerClaimPolicy(users, { secret: options.secret }),
    sessions,
    new DisabledOidcProvider(),
  );
}

/** The 6-digit code in the last email sent. */
function lastCode(): string {
  const match = /code is (\d{6})/.exec(mail.last?.text ?? '');
  if (!match?.[1]) throw new Error('no code was sent');
  return match[1];
}

beforeEach(() => {
  clock = new ManualClock();
  const nowMs = () => clock.now().getTime();
  users = new InMemoryUserRepository(() => clock.now());
  otps = new InMemoryOtpRepository();
  references = new InMemoryOtpReferenceStore({ ttlSec: 24 * 60 * 60 }, nowMs);
  otpHasher = new FakeOtpHasher();
  passwords = new FakePasswordHasher();
  mail = new RecordingMailSender();
  sessions = new RecordingSessionStarter();
  service = serviceWith();
});

describe('register (account-registration.UT03)', () => {
  it('account-registration.AC1 — creates an unverified member and mails a code', async () => {
    const issued = await service.register(REQUEST);

    expect(issued).toEqual({ reference: expect.any(String) as string, expiresInSec: 600 });
    const stored = await users.findByEmail(EMAIL);
    expect(stored).toMatchObject({ role: 'member', displayName: 'Ann' });
    expect(stored?.emailVerifiedAt).toBeUndefined();
    await expect(passwords.verify(stored?.passwordHash ?? '', REQUEST.password)).resolves.toBe(
      true,
    );
    expect(mail.sent).toHaveLength(1);
    expect(mail.last).toMatchObject({ to: EMAIL, subject: 'Your verification code' });
    expect(lastCode()).toMatch(/^\d{6}$/);
  });

  it('account-registration.AC2 — a verified address gets a decoy, nothing written or sent', async () => {
    const verified = await users.create({
      email: EMAIL,
      passwordHash: 'kept',
      displayName: 'Kept',
      emailVerifiedAt: new Date(),
    });
    const hashCallsBefore = otpHasher.hashCalls;

    const issued = await service.register(REQUEST);

    expect(issued).toEqual({ reference: expect.any(String) as string, expiresInSec: 600 });
    await expect(users.findById(verified.id)).resolves.toEqual(verified);
    expect(mail.sent).toHaveLength(0);
    // The decoy costs the same two bcrypt hashes as a real code.
    expect(otpHasher.hashCalls - hashCallsBefore).toBe(2);
    await expect(references.resolve(issued.reference)).resolves.toBeNull();
  });

  it('account-registration.AC3 — re-registering an unverified account replaces it', async () => {
    const first = await service.register(REQUEST);

    await service.register({ ...REQUEST, password: 'a different password', displayName: 'Bo' });

    const stored = await users.findByEmail(EMAIL);
    expect(stored?.displayName).toBe('Bo');
    await expect(passwords.verify(stored?.passwordHash ?? '', 'a different password')).resolves.toBe(
      true,
    );
    expect(mail.sent).toHaveLength(2);
    await expect(service.verify({ reference: first.reference, otp: '000000' })).rejects.toBeInstanceOf(
      OtpInvalidError,
    );
  });

  it('account-registration.AC4 — the matching secret makes the owner and closes the claim', async () => {
    await expect(service.options()).resolves.toEqual({ ownerClaimOpen: true, googleSignIn: false });

    await service.register({ ...REQUEST, ownerSecret: SECRET });

    await expect(users.findByEmail(EMAIL)).resolves.toMatchObject({ role: 'owner' });
    await expect(service.options()).resolves.toEqual({ ownerClaimOpen: false, googleSignIn: false });
  });

  it('a later member registration of the pending owner keeps it the owner', async () => {
    await service.register({ ...REQUEST, ownerSecret: SECRET });

    await service.register(REQUEST);

    await expect(users.findByEmail(EMAIL)).resolves.toMatchObject({ role: 'owner' });
  });

  it.each([
    ['a wrong value', SECRET, 'wrong'],
    ['no configured secret', undefined, SECRET],
  ])('account-registration.AC5 — refuses %s, writing and sending nothing', async (_c, secret, given) => {
    service = serviceWith(secret === undefined ? {} : { secret });

    await expect(service.register({ ...REQUEST, ownerSecret: given })).rejects.toBeInstanceOf(
      OwnerClaimRefusedError,
    );
    await expect(users.findByEmail(EMAIL)).resolves.toBeNull();
    expect(mail.sent).toHaveLength(0);
  });

  it('account-registration.AC5 — refuses the right secret once an owner exists', async () => {
    await users.create({ email: 'owner@example.test', passwordHash: 'h', displayName: 'O', role: 'owner' });

    await expect(service.register({ ...REQUEST, ownerSecret: SECRET })).rejects.toBeInstanceOf(
      OwnerClaimRefusedError,
    );
  });

  it('answers 503 with mail disabled and writes nothing', async () => {
    service = serviceWith({ secret: SECRET, mailSender: new DisabledMailSender() });

    await expect(service.register(REQUEST)).rejects.toBeInstanceOf(ServiceUnavailableError);
    await expect(users.findByEmail(EMAIL)).resolves.toBeNull();
  });
});

describe('verify (account-registration.UT04)', () => {
  it('account-registration.AC7 — verifies, deletes the code and starts a session', async () => {
    const { reference } = await service.register(REQUEST);

    const signedIn = await service.verify({ reference, otp: lastCode() });

    const stored = await users.findByEmail(EMAIL);
    expect(stored?.emailVerifiedAt).toEqual(clock.now());
    expect(signedIn.user).toMatchObject({ email: EMAIL, role: 'member' });
    expect(sessions.startedFor.map((user) => user.id)).toEqual([stored?.id]);
    await expect(references.resolve(reference)).resolves.toBeNull();
  });

  it('account-registration.AC8 — five wrong codes use the code up', async () => {
    const { reference } = await service.register(REQUEST);
    const code = lastCode();
    const wrong = code === '000000' ? '111111' : '000000';

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(service.verify({ reference, otp: wrong })).rejects.toBeInstanceOf(OtpInvalidError);
    }
    await expect(service.verify({ reference, otp: code })).rejects.toBeInstanceOf(OtpInvalidError);
    expect(sessions.startedFor).toHaveLength(0);
  });

  it('account-registration.AC8 — an expired code is OTP_EXPIRED and costs no attempt', async () => {
    const { reference } = await service.register(REQUEST);
    const code = lastCode();
    clock.advance(10 * 60 * 1_000);

    await expect(service.verify({ reference, otp: code })).rejects.toBeInstanceOf(OtpExpiredError);
    const record = await otps.findByIdentifier((await references.resolve(reference)) ?? '');
    expect(record?.attempts).toBe(0);
  });

  it('account-registration.AC12 — a password-reset code never verifies an email', async () => {
    const { reference } = await service.register(REQUEST);
    const identifier = (await references.resolve(reference)) ?? '';
    const record = await otps.findByIdentifier(identifier);
    if (!record) throw new Error('the code was not stored');
    // Re-label the stored code with the other purpose, as if it had been issued for it.
    await otps.upsert({ ...record, purpose: 'password_reset' });

    await expect(service.verify({ reference, otp: lastCode() })).rejects.toBeInstanceOf(
      OtpInvalidError,
    );
  });
});

describe('requestCode and resend (account-registration.UT05)', () => {
  it('account-registration.AC10 — sends for an unverified address only', async () => {
    await service.register(REQUEST);
    await users.create({ email: 'done@example.test', passwordHash: 'h', displayName: 'D', emailVerifiedAt: new Date() });

    await service.requestCode({ email: EMAIL });
    await service.requestCode({ email: 'done@example.test' });
    await service.requestCode({ email: 'nobody@example.test' });

    expect(mail.sent.map((message) => message.to)).toEqual([EMAIL, EMAIL]);
  });

  it('account-registration.AC11 — cooldown, then rotation that kills the old reference', async () => {
    const { reference } = await service.register(REQUEST);

    await expect(service.resend({ reference })).rejects.toBeInstanceOf(RateLimitedError);
    clock.advance(60 * 1_000);
    const next = await service.resend({ reference });

    expect(next.reference).not.toBe(reference);
    await expect(service.resend({ reference })).rejects.toBeInstanceOf(OtpInvalidError);
    await expect(service.verify({ reference: next.reference, otp: lastCode() })).resolves.toBeDefined();
  });

  it('refuses to resend for an account verified meanwhile', async () => {
    const { reference } = await service.register(REQUEST);
    const stored = await users.findByEmail(EMAIL);
    await users.markEmailVerified(stored?.id ?? '', clock.now());
    clock.advance(60 * 1_000);

    await expect(service.resend({ reference })).rejects.toBeInstanceOf(OtpInvalidError);
  });
});
