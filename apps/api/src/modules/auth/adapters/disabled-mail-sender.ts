/**
 * `IMailSender` for when no mail strategy is configured outside production (ADR-0009,
 * `owner-auth.AC22`). Every send is refused with 503 `SERVICE_UNAVAILABLE`, so password reset
 * answers 503 while sign-in and everything else keeps working — the mail counterpart of the AI
 * dev-bypass (`constitution.md` → Security Posture).
 *
 * `MailSenderFactory` never returns it in production: there, a missing strategy stops startup.
 * It deliberately takes no logger and keeps nothing from the message, because the body holds a
 * one-time code and the recipient is an email address (ADR-0009; `constitution.md` → PII /
 * logging rules).
 */
import { ServiceUnavailableError } from '../../../core/errors/index.js';
import type { IMailSender } from '../auth.interface.js';

export class DisabledMailSender implements IMailSender {
  send(): Promise<void> {
    return Promise.reject(new ServiceUnavailableError({}, 'Mail delivery is not configured'));
  }
}
