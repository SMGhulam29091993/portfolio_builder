/**
 * `IPasswordResetService` — password reset by a 6-digit one-time code sent by email
 * (`owner-auth.T08`; `owner-auth.API05`–`API07`; spec → Password reset by one-time code).
 *
 * How a code is held:
 * - the `otps` document (one per user and purpose) stores the bcrypt hash of the code and a
 *   random 64-hex-character identifier;
 * - the client holds a reference, `bcrypt(identifier)`, which Redis maps back to the identifier
 *   for 24 hours. The reference is never stored in MongoDB and the code is never stored at all.
 *
 * Business rules only: the service never sees `req` or `res`, and no code, identifier,
 * reference or email address is logged (`owner-auth.AC15`) — it takes no logger at all.
 */
import { OTP_LENGTH } from '@portfolio/contracts';

import { RateLimitedError } from '../../core/errors/index.js';
import { OtpExpiredError, OtpInvalidError } from './auth.errors.js';
import type {
  IClock,
  IMailSender,
  IOtpHasher,
  IOtpReferenceStore,
  IOtpRepository,
  IPasswordHasher,
  IPasswordResetService,
  ISecureRandom,
  ISessionStore,
  IUserPasswordWriter,
  IUserReader,
} from './auth.interface.js';
import type {
  ForgotPasswordRequest,
  OtpIssuedResponse,
  OtpPurpose,
  OtpRecord,
  ResendOtpRequest,
  ResetPasswordRequest,
} from './auth.types.js';

/** The one purpose a code can serve today; a code for one purpose never completes another. */
const PURPOSE: OtpPurpose = 'password_reset';

/** Identifier length: 32 random bytes, 64 hex characters (spec → Password reset). */
const IDENTIFIER_BYTES = 32;

/** How long a code verifies: 10 minutes after it was sent. */
const CODE_TTL_SEC = 10 * 60;

/**
 * When MongoDB's TTL index removes the document: 24 hours after the send, the lifetime of the
 * Redis reference, so a reference never outlives the document it leads to by more than the
 * TTL monitor's delay.
 */
const PURGE_AFTER_MS = 24 * 60 * 60 * 1_000;

/** A resend is refused until this long after the last send (`owner-auth.AC21`). */
const RESEND_COOLDOWN_MS = 60 * 1_000;

/** Wrong codes allowed per code; the next resend issues a fresh one (`owner-auth.AC19`). */
const MAX_ATTEMPTS = 5;

/** The email's subject. Plain text, no link (ADR-0009). */
const MAIL_SUBJECT = 'Your password reset code';

/** A freshly minted code and everything derived from it. Held in memory only. */
interface MintedCode {
  /** The raw code. Sent by email, never stored, never logged. */
  readonly code: string;
  readonly identifier: string;
  readonly otpHash: string;
  /** `bcrypt(identifier)`: what the client gets back and sends with the code. */
  readonly reference: string;
}

export class PasswordResetService implements IPasswordResetService {
  constructor(
    private readonly users: IUserReader,
    private readonly passwordWriter: IUserPasswordWriter,
    private readonly otps: IOtpRepository,
    private readonly references: IOtpReferenceStore,
    private readonly otpHasher: IOtpHasher,
    private readonly passwords: IPasswordHasher,
    private readonly sessions: ISessionStore,
    private readonly mail: IMailSender,
    private readonly random: ISecureRandom,
    private readonly clock: IClock,
  ) {}

  async requestCode({ email }: ForgotPasswordRequest): Promise<OtpIssuedResponse> {
    // First, so mail disabled outside production is 503 for every address — the decoy below
    // never sends, and would otherwise answer 200 — and nothing is written (`owner-auth.AC22`).
    await this.mail.ensureAvailable();
    const user = await this.users.findByEmail(email);
    // Minted before the lookup result is used, so an unknown address costs the same two
    // bcrypt hashes and gets a reference of the same shape (`owner-auth.AC17`).
    const minted = await this.mint();
    // Not the owner: a decoy. Nothing is written and nothing is sent.
    if (!user) return issuedResponse(minted.reference);

    await this.save(user.id, minted);
    await this.sendCode(user.email, minted.code);
    return issuedResponse(minted.reference);
  }

  async resend({ reference }: ResendOtpRequest): Promise<OtpIssuedResponse> {
    await this.mail.ensureAvailable();
    const record = await this.findRecord(reference);

    // From `sentAt` in MongoDB, so the cooldown survives a restart (spec → Error Handling).
    const sinceSentMs = this.clock.now().getTime() - record.sentAt.getTime();
    if (sinceSentMs < RESEND_COOLDOWN_MS) {
      throw new RateLimitedError(Math.ceil((RESEND_COOLDOWN_MS - sinceSentMs) / 1_000));
    }

    const user = await this.users.findById(record.userId);
    if (!user) throw new OtpInvalidError();

    // A whole new code, identifier and reference. The upsert overwrites the document, so the
    // old identifier — and with it the old reference and the old code — stops resolving.
    const minted = await this.mint();
    await this.save(user.id, minted);
    // Removed before the send, so it is cleaned up even when the provider refuses.
    await this.references.delete(reference);
    await this.sendCode(user.email, minted.code);
    return issuedResponse(minted.reference);
  }

  async reset({ reference, otp, newPassword }: ResetPasswordRequest): Promise<void> {
    const record = await this.findRecord(reference);

    // Used up: refused without comparing, so a sixth guess learns nothing (`owner-auth.UT15`).
    if (record.attempts >= MAX_ATTEMPTS) throw new OtpInvalidError();
    // Checked before an attempt is claimed: an expired code costs no attempt and its document
    // stays, so the reset screen can offer a resend (`owner-auth.AC20`).
    if (this.clock.now() >= record.expiresAt) throw new OtpExpiredError();

    // Claim the attempt before comparing. The increment is atomic in the store, so guesses
    // sent in parallel — which all read `attempts` before any of them failed — still get at
    // most five compares between them. A right code also spends one, which does not matter:
    // its document is deleted below.
    const attempts = await this.otps.incrementAttempts(record.id);
    if (attempts === null || attempts > MAX_ATTEMPTS) throw new OtpInvalidError();
    if (!(await this.otpHasher.compare(otp, record.otpHash))) throw new OtpInvalidError();

    const passwordHash = await this.passwords.hash(newPassword);
    const updated = await this.passwordWriter.updatePassword(
      record.userId,
      passwordHash,
      this.clock.now(),
    );
    // The user was removed after the code was issued; nothing is left to reset.
    if (!updated) throw new OtpInvalidError();

    await this.otps.deleteById(record.id);
    await this.references.delete(reference);
    // Ends the session wherever it is, so every browser must sign in again (`owner-auth.AC18`).
    await this.sessions.delete(record.userId);
  }

  /**
   * reference → Redis → identifier → `otps` document (spec → Password reset, lookup on
   * verify). One error for an unknown reference and for one whose document was replaced.
   */
  private async findRecord(reference: string): Promise<OtpRecord> {
    const identifier = await this.references.resolve(reference);
    if (identifier === null) throw new OtpInvalidError();
    const record = await this.otps.findByIdentifier(identifier);
    if (!record) throw new OtpInvalidError();
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
        `Your password reset code is ${code}.`,
        '',
        `It expires in ${String(CODE_TTL_SEC / 60)} minutes. If you did not ask to reset your ` +
          'password, you can ignore this email.',
      ].join('\n'),
    });
  }
}

/** API05 and API06 answer with the reference and the code's lifetime, never the code. */
function issuedResponse(reference: string): OtpIssuedResponse {
  return { reference, expiresInSec: CODE_TTL_SEC };
}
