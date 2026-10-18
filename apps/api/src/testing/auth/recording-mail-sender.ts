/**
 * `RecordingMailSender` — the `IMailSender` every test uses instead of a real provider
 * (ADR-0009: no test sends real mail).
 *
 * It keeps each accepted message so a test can read the one-time code back out of the body
 * (`owner-auth.IT16`, `UT12`), and can be switched to refuse sends the way a provider outage
 * would, so the 502 path is testable without a network. It passes the same contract suite as
 * `GmailMailSender` (`modules/auth/adapters/mail-sender.contract.spec.ts`, `owner-auth.CT06`).
 */
import { UpstreamError } from '../../core/errors/index.js';
import type { IMailSender, MailMessage } from '../../modules/auth/index.js';

export class RecordingMailSender implements IMailSender {
  /** Every message accepted so far, oldest first. Refused sends are not recorded. */
  readonly sent: MailMessage[] = [];

  private refusing = false;

  send(message: MailMessage): Promise<void> {
    if (this.refusing) return Promise.reject(new UpstreamError('mail'));
    // A copy, so a caller reusing its message object cannot rewrite what was "sent".
    this.sent.push({ ...message });
    return Promise.resolve();
  }

  /**
   * Makes every later `send` reject with `UpstreamError` (`provider: "mail"`), as
   * `GmailMailSender` does when Gmail refuses — until `acceptSends` is called.
   */
  refuseSends(): void {
    this.refusing = true;
  }

  /** Undoes `refuseSends`. */
  acceptSends(): void {
    this.refusing = false;
  }

  /** The most recent accepted message, or `undefined` when none was sent. */
  get last(): MailMessage | undefined {
    return this.sent.at(-1);
  }
}
