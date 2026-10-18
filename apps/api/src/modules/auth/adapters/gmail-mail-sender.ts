/**
 * `IMailSender` over Gmail SMTP through nodemailer — the default mail strategy (ADR-0009,
 * `owner-auth.T07`). It signs in with `GMAIL_USER` and a Gmail app password and sends one
 * plain-text part: no HTML, no attachments, no links.
 *
 * Failures cross the port only as `UpstreamError` (`provider: "mail"`, 502). nodemailer's own
 * error is not attached as the `cause`, because its message quotes the SMTP server's reply,
 * which can echo the recipient's address — and the cause is logged. The cause keeps only
 * nodemailer's error code and the SMTP status, which is enough to tell an authentication
 * failure from a refused recipient or an unreachable server.
 */
import { createTransport, type SMTPTransportOptions, type Transporter } from 'nodemailer';

import { UpstreamError } from '../../../core/errors/index.js';
import type { IMailSender } from '../auth.interface.js';
import type { MailMessage } from '../auth.types.js';

/** The provider name reported in `UPSTREAM_FAILED` responses and logs. */
const PROVIDER = 'mail';

/**
 * Bounds on one SMTP exchange. The send runs inside the forgot-password request, and
 * nodemailer's defaults (2 minutes to connect, 10 minutes of socket silence) would hold that
 * request far past any browser's patience; Gmail answers each step in well under a second.
 */
const CONNECTION_TIMEOUT_MS = 10_000;
const GREETING_TIMEOUT_MS = 10_000;
const SOCKET_TIMEOUT_MS = 20_000;

/** What the strategy needs from configuration. */
export interface GmailMailSenderOptions {
  /** `GMAIL_USER`: the account it signs in as. */
  readonly user: string;
  /** `GMAIL_APP_PASSWORD`. A secret: never logged. */
  readonly appPassword: string;
  /** The `From` address: `MAIL_FROM`, or `GMAIL_USER` when that is unset. */
  readonly from: string;
}

/** Where the SMTP connection goes; the subset of nodemailer's options that choose a server. */
export type SmtpEndpoint = Pick<
  SMTPTransportOptions,
  'service' | 'host' | 'port' | 'secure' | 'ignoreTLS'
>;

/**
 * Gmail, by nodemailer's well-known service entry (`smtp.gmail.com`, implicit TLS on 465), so
 * no provider host is written in this codebase.
 */
const GMAIL_ENDPOINT: SmtpEndpoint = { service: 'Gmail' };

export class GmailMailSender implements IMailSender {
  private readonly transport: Transporter;
  private readonly from: string;

  /**
   * @param options - Credentials and sender address, from the environment.
   * @param endpoint - Gmail in production. The contract suite passes a local SMTP server here
   *   (`owner-auth.CT06`); nothing else does.
   */
  constructor(options: GmailMailSenderOptions, endpoint: SmtpEndpoint = GMAIL_ENDPOINT) {
    // Building the transport opens no connection; each `send` connects, sends and closes.
    this.transport = createTransport({
      ...endpoint,
      auth: { user: options.user, pass: options.appPassword },
      connectionTimeout: CONNECTION_TIMEOUT_MS,
      greetingTimeout: GREETING_TIMEOUT_MS,
      socketTimeout: SOCKET_TIMEOUT_MS,
    });
    this.from = options.from;
  }

  /**
   * Always available: the factory only builds this sender when its variables are set. Opens no
   * connection — whether Gmail accepts is learned from `send`, as 502.
   */
  ensureAvailable(): Promise<void> {
    return Promise.resolve();
  }

  async send({ to, subject, text }: MailMessage): Promise<void> {
    try {
      await this.transport.sendMail({
        from: this.from,
        to,
        subject,
        text,
        // The message is ours and plain text, but nothing in it may ever make nodemailer read
        // a local file or fetch a URL.
        disableFileAccess: true,
        disableUrlAccess: true,
      });
    } catch (error) {
      throw new UpstreamError(PROVIDER, { cause: GmailMailSender.describeFailure(error) });
    }
  }

  /**
   * A log-safe stand-in for a nodemailer error: its error code (`EAUTH`, `EENVELOPE`,
   * `ECONNECTION`, …) and SMTP status, never its message or the server's reply text.
   */
  private static describeFailure(error: unknown): Error {
    const { code, responseCode } = (error ?? {}) as { code?: unknown; responseCode?: unknown };
    const parts = [
      `code ${typeof code === 'string' ? code : 'unknown'}`,
      ...(typeof responseCode === 'number' ? [`response ${String(responseCode)}`] : []),
    ];
    return new Error(`SMTP send failed (${parts.join(', ')})`);
  }
}
