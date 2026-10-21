/**
 * `IMailSender` over any SMTP server through nodemailer (ADR-0009, amended 2026-10-20 by
 * `cms-panel-shell.T08`). The `SMTP_URL` strategy uses it directly — e.g. a provider's SMTP
 * relay, or the local `smtp-server` the E2E harness runs — and `GmailMailSender` is this class
 * pointed at Gmail. One plain-text part: no HTML, no attachments, no links.
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
 * Bounds on one SMTP exchange. The send runs inside a request (forgot password, register), and
 * nodemailer's defaults (2 minutes to connect, 10 minutes of socket silence) would hold that
 * request far past any browser's patience; a working server answers each step in well under a
 * second.
 */
const CONNECTION_TIMEOUT_MS = 10_000;
const GREETING_TIMEOUT_MS = 10_000;
const SOCKET_TIMEOUT_MS = 20_000;

/** Where to connect: a well-known service, or a host and port. */
export type SmtpEndpoint = Pick<
  SMTPTransportOptions,
  'service' | 'host' | 'port' | 'secure' | 'ignoreTLS'
>;

/** Credentials, when the server needs them. Secrets: never logged. */
export interface SmtpCredentials {
  readonly user: string;
  readonly pass: string;
}

export class SmtpMailSender implements IMailSender {
  private readonly transport: Transporter;

  /**
   * @param endpoint - Where to connect.
   * @param credentials - The login, or `undefined` for a server that needs none.
   * @param from - The `From` address.
   */
  constructor(
    endpoint: SmtpEndpoint,
    credentials: SmtpCredentials | undefined,
    private readonly from: string,
  ) {
    // Building the transport opens no connection; each `send` connects, sends and closes.
    this.transport = createTransport({
      ...endpoint,
      ...(credentials ? { auth: { user: credentials.user, pass: credentials.pass } } : {}),
      connectionTimeout: CONNECTION_TIMEOUT_MS,
      greetingTimeout: GREETING_TIMEOUT_MS,
      socketTimeout: SOCKET_TIMEOUT_MS,
    });
  }

  /**
   * Always available: the factory only builds an SMTP sender when its variables are set. Opens no
   * connection — whether the server accepts is learned from `send`, as 502.
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
      throw new UpstreamError(PROVIDER, { cause: describeFailure(error) });
    }
  }
}

/**
 * A log-safe stand-in for a nodemailer error: its error code (`EAUTH`, `EENVELOPE`,
 * `ECONNECTION`, …) and SMTP status, never its message or the server's reply text.
 */
function describeFailure(error: unknown): Error {
  const { code, responseCode } = (error ?? {}) as { code?: unknown; responseCode?: unknown };
  const parts = [
    `code ${typeof code === 'string' ? code : 'unknown'}`,
    ...(typeof responseCode === 'number' ? [`response ${String(responseCode)}`] : []),
  ];
  return new Error(`SMTP send failed (${parts.join(', ')})`);
}

/** Where and how to connect, read from an `SMTP_URL`. */
export interface SmtpUrlSettings {
  readonly endpoint: SmtpEndpoint;
  readonly credentials: SmtpCredentials | undefined;
}

/**
 * Reads an `smtp://` or `smtps://` URL (`SMTP_URL`): `smtps:` connects with TLS from the start;
 * `user:pass@` is the login (percent-decoded). Pure — the container builds the sender from it,
 * as the composition root alone instantiates adapters.
 */
export function smtpUrlSettings(url: string): SmtpUrlSettings {
  const parsed = new URL(url);
  const secure = parsed.protocol === 'smtps:';
  const port = parsed.port ? Number(parsed.port) : secure ? 465 : 587;
  const credentials = parsed.username
    ? { user: decodeURIComponent(parsed.username), pass: decodeURIComponent(parsed.password) }
    : undefined;
  return { endpoint: { host: parsed.hostname, port, secure }, credentials };
}
