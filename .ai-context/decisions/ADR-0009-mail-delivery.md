# ADR-0009: Mail goes through one port; the sender is a strategy chosen by configuration
**Status:** Accepted — owner, 2026-10-17 (strategy pattern, Gmail through nodemailer as the
default, a provider such as Brevo taking over once it is set up). Amended 2026-10-18
(`owner-auth.T08`): the port gains `ensureAvailable()`; see Decision, first bullet.

## Context
The owner-auth password reset emails a one-time code. The constitution allows no external
service without an ADR, and the AI integration already sets the shape for a configurable
provider: one port, one adapter per provider, a factory, and a dev-bypass that never activates
in production (ADR-0003).

## Decision
- `auth` owns the port `IMailSender`: `send({ to, subject, text })`, and — since the
  2026-10-18 amendment — `ensureAvailable()`, which contacts no provider and rejects with 503
  only from `DisabledMailSender`. The password reset calls it before any other work, so "the
  routes that need mail answer 503" holds for every request, including an unknown address
  whose decoy answer never sends (`owner-auth.AC17`, `AC22`). Adapters rethrow provider
  failures as `UpstreamError` (`provider: "mail"`); no provider type crosses the port.
- Each provider is a strategy class: `GmailMailSender` (nodemailer over Gmail SMTP, using
  `GMAIL_USER` and `GMAIL_APP_PASSWORD`) is built now. `MailSenderFactory` holds the strategies
  in priority order and returns the first whose variables are all set. A provider added later,
  such as Brevo, is one new class plus one registration placed ahead of Gmail, so configuring
  it switches mail to it with no edit to existing code.
- `MAIL_FROM` is the sender address; when unset it defaults to `GMAIL_USER`.
- Environment rule, the same shape as the AI dev-bypass: outside production with no strategy
  configured, the factory returns `DisabledMailSender`, and the routes that need mail answer
  503 `SERVICE_UNAVAILABLE`. In production, startup fails when no strategy is configured.
  `DisabledMailSender` never logs a message body, because the body holds a one-time code.
- Messages are plain text. No HTML, no links.
- Every strategy passes one shared contract suite. Tests use a `RecordingMailSender` fake; no
  test sends real mail.

## Consequences
- A real email in local development needs a Gmail app password in `apps/api/.env`; without one,
  everything except password reset works.
- Gmail sending limits and deliverability apply until another provider is configured.
- nodemailer is pinned in ADR-0007 (10.1.2, installed by `owner-auth.T07`), with `smtp-server` as
  the dev-only local server the contract suite sends to.
- `constitution.md` → Approved LLD patterns lists `IMailSender` under Adapter + Factory, and
  Infrastructure lists the mail provider as an approved integration.
