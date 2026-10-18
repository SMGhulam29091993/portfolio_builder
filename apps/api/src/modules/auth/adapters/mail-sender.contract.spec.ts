/**
 * `owner-auth.CT06` — the shared contract suite for `IMailSender` (`constitution.md` → Liskov
 * Substitution; ADR-0009: every strategy passes one suite).
 *
 * `GmailMailSender` runs against a local SMTP server (`smtp-server`, from the nodemailer
 * project) that checks the credentials and keeps every message, so the real nodemailer path is
 * exercised and no test sends real mail. `RecordingMailSender` is the fake the service and route
 * tests use; `DisabledMailSender` is what the factory returns outside production when nothing is
 * configured. Each implementation takes the same message; the ones that deliver are held to the
 * same delivery and failure guarantees.
 */
import type { AddressInfo } from 'node:net';
import { inspect } from 'node:util';

import { SMTPServer } from 'smtp-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppError, ServiceUnavailableError, UpstreamError } from '../../../core/errors/index.js';
import { RecordingMailSender } from '../../../testing/index.js';
import type { IMailSender } from '../auth.interface.js';
import type { MailMessage } from '../auth.types.js';
import { DisabledMailSender } from './disabled-mail-sender.js';
import { GmailMailSender, type SmtpEndpoint } from './gmail-mail-sender.js';

/** Credentials the local server accepts. Placeholders: they only ever reach 127.0.0.1. */
const SMTP_USER = 'sender@portfolio.test';
const SMTP_APP_PASSWORD = 'contract-suite-app-password';
const MAIL_FROM = 'no-reply@portfolio.test';

/** The one message every implementation is given — shaped like the password-reset email. */
const MESSAGE: MailMessage = {
  to: 'owner@portfolio.test',
  subject: 'Your password reset code',
  text: 'Your code is 042917.\nIt expires in 10 minutes.',
};

/** One message as the local SMTP server received it. */
interface ReceivedMail {
  readonly envelopeFrom: string;
  readonly envelopeTo: readonly string[];
  /** The raw RFC 5322 message: headers, a blank line, the body. */
  readonly raw: string;
}

/**
 * A plain-SMTP server on an OS-assigned loopback port. STARTTLS is disabled and plain-text
 * authentication allowed, which is safe only because nothing leaves the machine.
 */
class LocalSmtpServer {
  readonly received: ReceivedMail[] = [];
  /** While `true`, every recipient is refused with a 550 that echoes the address back. */
  refuseRecipients = false;

  private readonly server = new SMTPServer({
    secure: false,
    disabledCommands: ['STARTTLS'],
    authMethods: ['PLAIN', 'LOGIN'],
    allowInsecureAuth: true,
    logger: false,
    onAuth: (auth, _session, callback) => {
      if (auth.username === SMTP_USER && auth.password === SMTP_APP_PASSWORD) {
        callback(null, { user: auth.username });
      } else {
        callback(new Error('Invalid username or password'));
      }
    },
    onRcptTo: (address, _session, callback) => {
      if (!this.refuseRecipients) {
        callback();
        return;
      }
      // Real servers quote the address in their reply; the adapter must not pass it on.
      callback(Object.assign(new Error(`Mailbox <${address.address}> unavailable`), { responseCode: 550 }));
    },
    onData: (stream, session, callback) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => {
        const { mailFrom, rcptTo } = session.envelope;
        this.received.push({
          envelopeFrom: mailFrom ? mailFrom.address : '',
          envelopeTo: rcptTo.map((recipient) => recipient.address),
          raw: Buffer.concat(chunks).toString('utf8'),
        });
        callback();
      });
    },
  });

  async start(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.server.listen(0, '127.0.0.1', resolve);
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(resolve);
    });
  }

  /** Where a `GmailMailSender` under test should connect instead of Gmail. */
  get endpoint(): SmtpEndpoint {
    const { port } = this.server.server.address() as AddressInfo;
    return { host: '127.0.0.1', port, secure: false, ignoreTLS: true };
  }

  reset(): void {
    this.received.length = 0;
    this.refuseRecipients = false;
  }
}

/** The headers and decoded body of a raw message whose body is 7-bit plain text. */
function parseRaw(raw: string): { headers: string; body: string } {
  const normalised = raw.replaceAll('\r\n', '\n');
  const split = normalised.indexOf('\n\n');
  return { headers: normalised.slice(0, split), body: normalised.slice(split + 2).replace(/\n$/, '') };
}

/** The value of header `name`, case-insensitive; `undefined` when absent. */
function header(headers: string, name: string): string | undefined {
  const line = headers.split('\n').find((candidate) => candidate.toLowerCase().startsWith(`${name.toLowerCase()}:`));
  return line?.slice(name.length + 1).trim();
}

const smtp = new LocalSmtpServer();

beforeAll(async () => {
  await smtp.start();
});

afterAll(async () => {
  await smtp.stop();
});

beforeEach(() => {
  smtp.reset();
});

/** Builds a Gmail sender pointed at the local server. */
function localGmail(appPassword = SMTP_APP_PASSWORD): GmailMailSender {
  return new GmailMailSender({ user: SMTP_USER, appPassword, from: MAIL_FROM }, smtp.endpoint);
}

/** An implementation that delivers, with what the delivery guarantees need to observe it. */
interface DeliveringSender {
  readonly sender: IMailSender;
  /** Every message the provider accepted, as `{ to, subject, text }`. */
  readonly delivered: () => MailMessage[];
  /** Makes the provider refuse every later send. */
  readonly refuse: () => void;
}

const deliveringSenders: readonly { name: string; create: () => DeliveringSender }[] = [
  {
    name: 'GmailMailSender (local SMTP server)',
    create: () => ({
      sender: localGmail(),
      delivered: () =>
        smtp.received.map(({ envelopeTo, raw }) => {
          const { headers, body } = parseRaw(raw);
          return { to: envelopeTo.join(','), subject: header(headers, 'subject') ?? '', text: body };
        }),
      refuse: () => {
        smtp.refuseRecipients = true;
      },
    }),
  },
  {
    name: 'RecordingMailSender',
    create: () => {
      const sender = new RecordingMailSender();
      return {
        sender,
        delivered: () => sender.sent,
        refuse: () => {
          sender.refuseSends();
        },
      };
    },
  },
];

const everySender: readonly { name: string; create: () => IMailSender }[] = [
  ...deliveringSenders.map(({ name, create }) => ({ name, create: () => create().sender })),
  { name: 'DisabledMailSender', create: () => new DisabledMailSender() },
];

describe.each(everySender)('owner-auth.CT06 — IMailSender contract — $name', ({ create }) => {
  it('takes the shared message and settles with nothing or an AppError, never a provider type', async () => {
    const outcome = await create()
      .send(MESSAGE)
      .then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      );

    if ('error' in outcome) {
      expect(outcome.error).toBeInstanceOf(AppError);
    } else {
      expect(outcome.value).toBeUndefined();
    }
  });
});

describe.each(everySender)('owner-auth.CT06 — IMailSender availability — $name', ({ create }) => {
  it('ensureAvailable() settles with nothing or an AppError, never a provider type', async () => {
    const outcome = await create()
      .ensureAvailable()
      .then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      );

    if ('error' in outcome) {
      expect(outcome.error).toBeInstanceOf(AppError);
    } else {
      expect(outcome.value).toBeUndefined();
    }
  });
});

describe.each(deliveringSenders)('owner-auth.CT06 — delivering IMailSender — $name', ({ create }) => {
  it('owner-auth.AC22 — ensureAvailable() resolves and delivers nothing', async () => {
    const { sender, delivered } = create();

    await expect(sender.ensureAvailable()).resolves.toBeUndefined();
    expect(delivered()).toEqual([]);
  });

  it('owner-auth.AC16 — delivers the recipient, subject and plain-text body unchanged', async () => {
    const { sender, delivered } = create();

    await sender.send(MESSAGE);

    expect(delivered()).toEqual([MESSAGE]);
  });

  it('owner-auth.AC22 — surfaces a provider refusal as UpstreamError with provider "mail"', async () => {
    const { sender, delivered, refuse } = create();
    refuse();

    const error: unknown = await sender.send(MESSAGE).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(UpstreamError);
    expect(error).toMatchObject({ status: 502, code: 'UPSTREAM_FAILED', details: { provider: 'mail' } });
    expect(delivered()).toEqual([]);
  });
});

describe('owner-auth.CT06 — DisabledMailSender', () => {
  // Through the port, as the password reset will hold it.
  const disabled: IMailSender = new DisabledMailSender();

  it('owner-auth.AC22 — ensureAvailable() rejects with SERVICE_UNAVAILABLE (503)', async () => {
    const error: unknown = await disabled.ensureAvailable().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ServiceUnavailableError);
    expect(error).toMatchObject({ status: 503, code: 'SERVICE_UNAVAILABLE' });
  });

  it('owner-auth.AC22 — refuses every send with SERVICE_UNAVAILABLE (503)', async () => {
    const error: unknown = await disabled.send(MESSAGE).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ServiceUnavailableError);
    expect(error).toMatchObject({ status: 503, code: 'SERVICE_UNAVAILABLE' });
  });

  it('keeps no part of the message — the body holds a one-time code (ADR-0009)', async () => {
    const error: unknown = await disabled.send(MESSAGE).catch((caught: unknown) => caught);
    const everything = inspect(error, { depth: Infinity });

    expect(everything).not.toContain('042917');
    expect(everything).not.toContain(MESSAGE.to);
  });
});

describe('GmailMailSender against the local SMTP server', () => {
  it('sends from MAIL_FROM as one text/plain part, with no HTML (ADR-0009)', async () => {
    await localGmail().send(MESSAGE);

    const [mail] = smtp.received;
    expect(mail?.envelopeFrom).toBe(MAIL_FROM);
    const { headers } = parseRaw(mail?.raw ?? '');
    expect(header(headers, 'from')).toBe(MAIL_FROM);
    expect(header(headers, 'content-type')).toMatch(/^text\/plain/);
    expect(mail?.raw).not.toMatch(/text\/html|multipart/i);
  });

  it('signs in with the app password; a wrong one is an UpstreamError and nothing is sent', async () => {
    const error: unknown = await localGmail('wrong-app-password')
      .send(MESSAGE)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(UpstreamError);
    expect(smtp.received).toEqual([]);
  });

  it('ensureAvailable() opens no connection: it resolves even when the server is unreachable', async () => {
    const sender = new GmailMailSender(
      { user: SMTP_USER, appPassword: SMTP_APP_PASSWORD, from: MAIL_FROM },
      { host: '127.0.0.1', port: 1, secure: false, ignoreTLS: true },
    );

    await expect(sender.ensureAvailable()).resolves.toBeUndefined();
  });

  it('turns an unreachable server into an UpstreamError', async () => {
    // Port 1 on loopback: nothing listens there, so the connection is refused at once.
    const sender = new GmailMailSender(
      { user: SMTP_USER, appPassword: SMTP_APP_PASSWORD, from: MAIL_FROM },
      { host: '127.0.0.1', port: 1, secure: false, ignoreTLS: true },
    );

    await expect(sender.send(MESSAGE)).rejects.toBeInstanceOf(UpstreamError);
  });

  it('owner-auth.AC15 — the error and its logged cause carry no address, credential, code or server reply', async () => {
    smtp.refuseRecipients = true;

    const error: unknown = await localGmail()
      .send(MESSAGE)
      .catch((caught: unknown) => caught);
    // Everything the JSON logger would print: message, stack and the whole cause chain.
    const everything = inspect(error, { depth: Infinity });

    expect(error).toBeInstanceOf(UpstreamError);
    for (const secret of [MESSAGE.to, SMTP_USER, SMTP_APP_PASSWORD, MAIL_FROM, '042917', 'Mailbox']) {
      expect(everything).not.toContain(secret);
    }
    // What is kept is enough to diagnose: nodemailer's error code and the SMTP status.
    expect((error as Error).cause).toBeInstanceOf(Error);
    expect(((error as Error).cause as Error).message).toMatch(/EENVELOPE.*550/);
  });
});
