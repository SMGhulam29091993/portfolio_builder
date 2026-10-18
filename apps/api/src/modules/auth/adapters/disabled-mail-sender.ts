/**
 * `IMailSender` for when no mail strategy is configured outside production (ADR-0009,
 * `owner-auth.AC22`). `ensureAvailable` and every send are refused with 503
 * `SERVICE_UNAVAILABLE`, so password reset answers 503 while sign-in and everything else keeps
 * working — the mail counterpart of the AI dev-bypass (`constitution.md` → Security Posture).
 *
 * `MailSenderFactory` never returns it in production: there, a missing strategy stops startup.
 * It deliberately takes no logger and keeps nothing from the message, because the body holds a
 * one-time code and the recipient is an email address (ADR-0009; `constitution.md` → PII /
 * logging rules).
 */
import { ServiceUnavailableError } from '../../../core/errors/index.js';
import type { IMailSender } from '../auth.interface.js';

/** Client-safe message for every refusal; says nothing about which variables are unset. */
const NOT_CONFIGURED_MESSAGE = 'Mail delivery is not configured';

export class DisabledMailSender implements IMailSender {
  ensureAvailable(): Promise<void> {
    return Promise.reject(new ServiceUnavailableError({}, NOT_CONFIGURED_MESSAGE));
  }

  send(): Promise<void> {
    return Promise.reject(new ServiceUnavailableError({}, NOT_CONFIGURED_MESSAGE));
  }
}
