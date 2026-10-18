/**
 * `owner-auth.UT18` — `MailSenderFactory` picks the mail strategy from configuration
 * (ADR-0009, `owner-auth.AC22`): the first strategy whose variables are all set wins; with none,
 * production refuses to start and every other environment gets the disabled sender.
 *
 * The strategies here build `RecordingMailSender`s, so the test sees exactly which one was
 * chosen and with what configuration, without nodemailer.
 */
import { describe, expect, it } from 'vitest';

import { loadEnv, type Env } from '../../../config/env.js';
import { RecordingMailSender } from '../../../testing/index.js';
import { DisabledMailSender } from './disabled-mail-sender.js';
import { MailNotConfiguredError, MailSenderFactory } from './mail-sender.factory.js';

/** Everything `loadEnv` requires, with no mail variable set. */
const BASE_SOURCE = {
  PORT: '4100',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/portfolio',
  REDIS_URL: 'redis://127.0.0.1:6379/0',
  JWT_ACCESS_SECRET: 'not-a-real-secret-but-32-chars-long-0000',
  WEB_ORIGIN: 'https://portfolio.example',
} as const;

const GMAIL = {
  GMAIL_USER: 'sender@portfolio.example',
  GMAIL_APP_PASSWORD: 'not-a-real-app-password',
} as const;

function envOf(source: Record<string, string>): Env {
  return loadEnv({ ...BASE_SOURCE, ...source });
}

/** A Gmail-shaped strategy that records the configuration it was built with. */
function gmailStrategy(built: Record<string, string>[] = []) {
  const sender = new RecordingMailSender();
  const strategy = MailSenderFactory.strategy(
    ['GMAIL_USER', 'GMAIL_APP_PASSWORD'],
    ({ GMAIL_USER, GMAIL_APP_PASSWORD }) => {
      built.push({ GMAIL_USER, GMAIL_APP_PASSWORD });
      return sender;
    },
  );
  return { strategy, sender, built };
}

describe('owner-auth.UT18 — MailSenderFactory', () => {
  it.each(['production', 'development', 'test'])(
    'returns the Gmail sender, built from its variables, when Gmail is configured (%s)',
    (nodeEnv) => {
      const gmail = gmailStrategy();
      const factory = new MailSenderFactory([gmail.strategy], new DisabledMailSender());

      const sender = factory.create(envOf({ NODE_ENV: nodeEnv, ...GMAIL }));

      expect(sender).toBe(gmail.sender);
      expect(gmail.built).toEqual([GMAIL]);
    },
  );

  it('owner-auth.AC22 — throws in production with nothing configured, naming the missing variables', () => {
    const factory = new MailSenderFactory([gmailStrategy().strategy], new DisabledMailSender());

    const create = () => factory.create(envOf({ NODE_ENV: 'production' }));

    expect(create).toThrow(MailNotConfiguredError);
    expect(create).toThrow(/GMAIL_USER, GMAIL_APP_PASSWORD/);
    try {
      create();
    } catch (error) {
      expect((error as MailNotConfiguredError).variables).toEqual(['GMAIL_USER', 'GMAIL_APP_PASSWORD']);
    }
  });

  it('owner-auth.AC22 — names only the variable still missing when Gmail is half configured in production', () => {
    const factory = new MailSenderFactory([gmailStrategy().strategy], new DisabledMailSender());

    let caught: unknown;
    try {
      factory.create(envOf({ NODE_ENV: 'production', GMAIL_USER: GMAIL.GMAIL_USER }));
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(MailNotConfiguredError);
    expect((caught as MailNotConfiguredError).variables).toEqual(['GMAIL_APP_PASSWORD']);
    // Names only: the set value is not echoed.
    expect((caught as Error).message).not.toContain(GMAIL.GMAIL_USER);
  });

  it.each([
    ['development', 'nothing set', {}],
    ['test', 'nothing set', {}],
    ['development', 'Gmail half configured', { GMAIL_USER: GMAIL.GMAIL_USER }],
  ])('owner-auth.AC22 — returns the disabled sender in %s with %s', (nodeEnv, _case, extra) => {
    const disabled = new DisabledMailSender();
    const gmail = gmailStrategy();
    const factory = new MailSenderFactory([gmail.strategy], disabled);

    expect(factory.create(envOf({ NODE_ENV: nodeEnv, ...extra }))).toBe(disabled);
    expect(gmail.built).toEqual([]);
  });

  it('takes the first configured strategy in priority order, and skips an unconfigured one', () => {
    // How a later provider such as Brevo takes over: one registration placed ahead of Gmail.
    const ahead = new RecordingMailSender();
    const aheadStrategy = MailSenderFactory.strategy(['MAIL_FROM'], () => ahead);
    const gmail = gmailStrategy();
    const factory = new MailSenderFactory([aheadStrategy, gmail.strategy], new DisabledMailSender());

    expect(factory.create(envOf({ ...GMAIL, MAIL_FROM: 'no-reply@portfolio.example' }))).toBe(ahead);
    expect(factory.create(envOf({ ...GMAIL }))).toBe(gmail.sender);
  });

  it('passes the whole environment to a strategy, for its optional variables', () => {
    let seenFrom: string | undefined;
    const strategy = MailSenderFactory.strategy(['GMAIL_USER'], (_config, env) => {
      seenFrom = env.MAIL_FROM;
      return new RecordingMailSender();
    });

    new MailSenderFactory([strategy], new DisabledMailSender()).create(
      envOf({ GMAIL_USER: GMAIL.GMAIL_USER, MAIL_FROM: 'no-reply@portfolio.example' }),
    );

    expect(seenFrom).toBe('no-reply@portfolio.example');
  });
});
