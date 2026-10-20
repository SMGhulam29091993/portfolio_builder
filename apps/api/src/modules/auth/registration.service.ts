/**
 * `IRegistrationService` — registration and email verification (`account-registration.T02`;
 * `account-registration.API01`–`API05`; spec → Email verification).
 *
 * Codes follow the one-time-code contract of `owner-auth` with the purpose
 * `email_verification`: the `otps` document holds the bcrypt hash of the code and a random
 * identifier, the client holds `bcrypt(identifier)` as its reference, and Redis maps the
 * reference back for 24 hours. The mint/save/send steps repeat `PasswordResetService`'s for a
 * second purpose (`memory/patterns.md` → One-time code issuance).
 *
 * No response says whether an email is registered: a verified address gets a decoy reference
 * minted the same way, with nothing written or sent (`account-registration.AC2`, `AC10`).
 * Nothing here is logged — the service takes no logger.
 */
import { OTP_LENGTH } from '@portfolio/contracts';

import { ConflictError, RateLimitedError } from '../../core/errors/index.js';
import { OtpExpiredError, OtpInvalidError } from './auth.errors.js';
import type {
  IClock,
  IMailSender,
  IOtpHasher,
  IOtpReferenceStore,
  IOtpRepository,
  IOwnerClaimPolicy,
  IPasswordHasher,
  IRegistrationService,
  ISecureRandom,
  ISessionStarter,
  IUserCreator,
  IUserReader,
  IUserRegistrar,
} from './auth.interface.js';
import type {
  OtpIssuedResponse,
  OtpPurpose,
  OtpRecord,
  RegisterRequest,
  RegistrationOptionsResponse,
  SignedInSession,
  User,
  UserRole,
  VerificationCodeRequest,
  VerificationResendRequest,
  VerifyEmailRequest,
} from './auth.types.js';

/** This service's codes; a password-reset code never verifies an email (AC12). */
const PURPOSE: OtpPurpose = 'email_verification';

/** Identifier length: 32 random bytes, 64 hex characters (as `owner-auth`). */
const IDENTIFIER_BYTES = 32;

/** How long a code verifies: 10 minutes (one-time-code contract). */
const CODE_TTL_SEC = 10 * 60;

/** When MongoDB's TTL index removes the document: with the Redis reference, after 24 hours. */
const PURGE_AFTER_MS = 24 * 60 * 60 * 1_000;

/** A resend is refused until this long after the last send (`account-registration.AC11`). */
const RESEND_COOLDOWN_MS = 60 * 1_000;

/** Wrong codes allowed per code (`account-registration.AC8`). */
const MAX_ATTEMPTS = 5;

/** The email's subject. Plain text, no link (ADR-0009). */
const MAIL_SUBJECT = 'Your verification code';

/** A freshly minted code and everything derived from it. Held in memory only. */
interface MintedCode {
  /** The raw code. Sent by email, never stored, never logged. */
  readonly code: string;
  readonly identifier: string;
  readonly otpHash: string;
  /** `bcrypt(identifier)`: what the client gets back and sends with the code. */
  readonly reference: string;
}

export class RegistrationService implements IRegistrationService {
  constructor(
    private readonly users: IUserReader,
    private readonly creator: IUserCreator,
    private readonly registrar: IUserRegistrar,
    private readonly otps: IOtpRepository,
    private readonly references: IOtpReferenceStore,
    private readonly otpHasher: IOtpHasher,
    private readonly passwords: IPasswordHasher,
    private readonly mail: IMailSender,
    private readonly random: ISecureRandom,
    private readonly clock: IClock,
    private readonly ownerClaim: IOwnerClaimPolicy,
    private readonly sessions: ISessionStarter,
  ) {}

  async options(): Promise<RegistrationOptionsResponse> {
    return { ownerClaimOpen: await this.ownerClaim.isOpen() };
  }

  async register({
    email,
    password,
    displayName,
    ownerSecret,
  }: RegisterRequest): Promise<OtpIssuedResponse> {
    // Mail first, so with mail disabled every address answers 503 and nothing is written.
    await this.mail.ensureAvailable();
    // The claim next: a refused secret writes and sends nothing (`account-registration.AC5`).
    const role = await this.ownerClaim.decide(ownerSecret);
    const existing = await this.users.findByEmail(email);
    // Hashed and minted for every outcome, so a verified address costs the same work.
    const passwordHash = await this.passwords.hash(password);
    const minted = await this.mint();

    const account = await this.upsertPending(existing, { email, passwordHash, displayName, role });
    // A verified address — or one verified while this request ran: a decoy, nothing sent.
    if (!account) return issuedResponse(minted.reference);

    await this.save(account.id, minted);
    await this.sendCode(account.email, minted.code);
    return issuedResponse(minted.reference);
  }

  async verify({ reference, otp }: VerifyEmailRequest): Promise<SignedInSession> {
    const record = await this.findRecord(reference);

    // Same order as the password reset: used up, then expired (free), then claim an attempt
    // atomically before comparing, so parallel guesses get five compares at most.
    if (record.attempts >= MAX_ATTEMPTS) throw new OtpInvalidError();
    if (this.clock.now() >= record.expiresAt) throw new OtpExpiredError();
    const attempts = await this.otps.incrementAttempts(record.id);
    if (attempts === null || attempts > MAX_ATTEMPTS) throw new OtpInvalidError();
    if (!(await this.otpHasher.compare(otp, record.otpHash))) throw new OtpInvalidError();

    if (!(await this.registrar.markEmailVerified(record.userId, this.clock.now()))) {
      throw new OtpInvalidError();
    }
    await this.otps.deleteById(record.id);
    await this.references.delete(reference);

    const user = await this.users.findById(record.userId);
    if (!user) throw new OtpInvalidError();
    return this.sessions.startFor(user);
  }

  async requestCode({ email }: VerificationCodeRequest): Promise<OtpIssuedResponse> {
    await this.mail.ensureAvailable();
    const user = await this.users.findByEmail(email);
    const minted = await this.mint();
    // Unknown or already verified: a decoy, nothing written or sent (AC10).
    if (!user || user.emailVerifiedAt) return issuedResponse(minted.reference);

    await this.save(user.id, minted);
    await this.sendCode(user.email, minted.code);
    return issuedResponse(minted.reference);
  }

  async resend({ reference }: VerificationResendRequest): Promise<OtpIssuedResponse> {
    await this.mail.ensureAvailable();
    const record = await this.findRecord(reference);

    // From `sentAt` in MongoDB, so the cooldown survives a restart.
    const sinceSentMs = this.clock.now().getTime() - record.sentAt.getTime();
    if (sinceSentMs < RESEND_COOLDOWN_MS) {
      throw new RateLimitedError(Math.ceil((RESEND_COOLDOWN_MS - sinceSentMs) / 1_000));
    }

    const user = await this.users.findById(record.userId);
    // Gone, or verified meanwhile: there is nothing left to verify.
    if (!user || user.emailVerifiedAt) throw new OtpInvalidError();

    const minted = await this.mint();
    await this.save(user.id, minted);
    // Removed before the send, so it is cleaned up even when the provider refuses.
    await this.references.delete(reference);
    await this.sendCode(user.email, minted.code);
    return issuedResponse(minted.reference);
  }

  /**
   * Creates the account, or refreshes an unverified one (`account-registration.AC3`).
   *
   * @returns The account to send a code to, or `null` when the address is already verified.
   */
  private async upsertPending(
    existing: User | null,
    pending: { email: string; passwordHash: string; displayName: string; role: UserRole },
  ): Promise<User | null> {
    const { email, passwordHash, displayName, role } = pending;
    if (existing) {
      if (existing.emailVerifiedAt) return null;
      // A member registration never demotes an account that already claimed the owner role;
      // only a matching claim changes the role.
      return this.registrar.updatePending(existing.id, {
        passwordHash,
        displayName,
        ...(role === 'owner' ? { role } : {}),
      });
    }
    try {
      return await this.creator.create({ email, passwordHash, displayName, role });
    } catch (error) {
      // A parallel registration created the address first: answer as for an existing account
      // without writing — the other request sent its own code. `OWNER_EXISTS` propagates (409).
      if (error instanceof ConflictError && error.code === 'USER_EXISTS') return null;
      throw error;
    }
  }

  /** reference → Redis → identifier → a verification-code document, or `OTP_INVALID`. */
  private async findRecord(reference: string): Promise<OtpRecord> {
    const identifier = await this.references.resolve(reference);
    if (identifier === null) throw new OtpInvalidError();
    const record = await this.otps.findByIdentifier(identifier);
    if (record?.purpose !== PURPOSE) throw new OtpInvalidError();
    return record;
  }

  /** A new code, identifier, code hash and reference. */
  private async mint(): Promise<MintedCode> {
    const code = this.random.numericCode(OTP_LENGTH);
    const identifier = this.random.hex(IDENTIFIER_BYTES);
    const [otpHash, reference] = await Promise.all([
      this.otpHasher.hash(code),
      this.otpHasher.hash(identifier),
    ]);
    return { code, identifier, otpHash, reference };
  }

  /** Writes the code's document (upsert, `attempts` back to 0) and maps its reference. */
  private async save(userId: string, minted: MintedCode): Promise<void> {
    const sentAt = this.clock.now();
    await this.otps.upsert({
      userId,
      purpose: PURPOSE,
      identifier: minted.identifier,
      otpHash: minted.otpHash,
      sentAt,
      expiresAt: new Date(sentAt.getTime() + CODE_TTL_SEC * 1_000),
      purgeAt: new Date(sentAt.getTime() + PURGE_AFTER_MS),
    });
    await this.references.put(minted.reference, minted.identifier);
  }

  /** Emails the code: plain text, the code and its expiry, no link (ADR-0009). */
  private sendCode(to: string, code: string): Promise<void> {
    return this.mail.send({
      to,
      subject: MAIL_SUBJECT,
      text: [
        `Your verification code is ${code}.`,
        '',
        `It expires in ${String(CODE_TTL_SEC / 60)} minutes. If you did not create an ` +
          'account, you can ignore this email.',
      ].join('\n'),
    });
  }
}

/** API02, API04 and API05 answer with the reference and the code's lifetime, never the code. */
function issuedResponse(reference: string): OtpIssuedResponse {
  return { reference, expiresInSec: CODE_TTL_SEC };
}
