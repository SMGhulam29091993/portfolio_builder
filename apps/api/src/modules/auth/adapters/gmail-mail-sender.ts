/**
 * `IMailSender` over Gmail SMTP — the default mail strategy (ADR-0009, `owner-auth.T07`): an
 * `SmtpMailSender` pointed at nodemailer's well-known `Gmail` service, signing in with
 * `GMAIL_USER` and a Gmail app password. Sending, timeouts and log-safe failures are the base
 * class's (since `cms-panel-shell.T08`, which added the generic `SMTP_URL` strategy).
 */
import { SmtpMailSender, type SmtpEndpoint } from './smtp-mail-sender.js';

export type { SmtpEndpoint } from './smtp-mail-sender.js';

/** What the strategy needs from configuration. */
export interface GmailMailSenderOptions {
  /** `GMAIL_USER`: the account it signs in as. */
  readonly user: string;
  /** `GMAIL_APP_PASSWORD`. A secret: never logged. */
  readonly appPassword: string;
  /** The `From` address: `MAIL_FROM`, or `GMAIL_USER` when that is unset. */
  readonly from: string;
}

/** Gmail's SMTP endpoint, as nodemailer's well-known service entry knows it. */
const GMAIL_ENDPOINT: SmtpEndpoint = { service: 'Gmail' };

export class GmailMailSender extends SmtpMailSender {
  /**
   * @param options - Credentials and sender address, from the environment.
   * @param endpoint - Gmail in production. The contract suite passes a local SMTP server here
   *   (`owner-auth.CT06`); nothing else does.
   */
  constructor(options: GmailMailSenderOptions, endpoint: SmtpEndpoint = GMAIL_ENDPOINT) {
    super(endpoint, { user: options.user, pass: options.appPassword }, options.from);
  }
}
