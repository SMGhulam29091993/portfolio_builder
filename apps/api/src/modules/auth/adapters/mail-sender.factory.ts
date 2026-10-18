/**
 * `MailSenderFactory` — picks the `IMailSender` strategy from configuration (ADR-0009,
 * `owner-auth.AC22`). This is the one place the mail decision is made, in the same shape as the
 * AI dev-bypass (`constitution.md` → Security Posture):
 *   1. the first registered strategy whose variables are all set wins;
 *   2. none configured and `NODE_ENV=production` → `MailNotConfiguredError`, so startup fails
 *      naming the missing variables;
 *   3. none configured anywhere else → the disabled sender (password reset answers 503).
 *
 * Strategies are registrations, not code here (Open / Closed): `container.ts` lists them in
 * priority order and builds each sender, as the composition root must. A later provider such as
 * Brevo is one new adapter class plus one registration placed ahead of Gmail; this file does
 * not change.
 */
import type { Env } from '../../../config/env.js';
import type { IMailSender } from '../auth.interface.js';

/** Environment variables a strategy can require: the ones that may be unset. */
type OptionalVariable = {
  [K in keyof Env]-?: undefined extends Env[K] ? K : never;
}[keyof Env];

/** The values of `K`, all known to be set. */
type SetValues<K extends OptionalVariable> = { readonly [P in K]: NonNullable<Env[P]> };

/** One registered mail strategy. Build it with `MailSenderFactory.strategy`. */
export interface MailStrategy {
  /** Every variable the strategy needs, in the order an error names them. */
  readonly variables: readonly OptionalVariable[];
  /** Builds the sender; called only once all of `variables` are set. */
  create(env: Env): IMailSender;
}

/**
 * Raised in production when no mail strategy is configured. Carries variable **names** only —
 * never a value, since one that is set may be a secret (`constitution.md` → PII / logging rules).
 */
export class MailNotConfiguredError extends Error {
  /** For each strategy, its variables still unset, in priority order and without repeats. */
  readonly variables: readonly string[];

  constructor(variables: readonly string[]) {
    super(`No mail strategy is configured; set ${variables.join(', ')}`);
    this.name = 'MailNotConfiguredError';
    this.variables = Object.freeze([...variables]);
  }
}

export class MailSenderFactory {
  /**
   * Declares a strategy. `create` receives the required variables already narrowed to set
   * values, plus the whole environment for optional ones (`MAIL_FROM`).
   *
   * @param variables - What the strategy needs; it is chosen only when every one is set.
   * @param create - Builds the sender from those values.
   */
  static strategy<const K extends OptionalVariable>(
    variables: readonly K[],
    create: (values: SetValues<K>, env: Env) => IMailSender,
  ): MailStrategy {
    return {
      variables,
      create: (env) => {
        const values = Object.fromEntries(variables.map((name) => [name, env[name]]));
        // Sound: the factory calls this only after checking every variable is set.
        return create(values as SetValues<K>, env);
      },
    };
  }

  /**
   * @param strategies - Highest priority first.
   * @param disabled - Returned outside production when nothing is configured.
   */
  constructor(
    private readonly strategies: readonly MailStrategy[],
    private readonly disabled: IMailSender,
  ) {}

  /**
   * The sender for this environment.
   *
   * @throws {MailNotConfiguredError} `NODE_ENV=production` and no strategy is configured.
   */
  create(env: Env): IMailSender {
    const chosen = this.strategies.find((strategy) =>
      strategy.variables.every((name) => env[name] !== undefined),
    );
    if (chosen) return chosen.create(env);

    // Never the disabled sender in production: a deployment that cannot mail a reset code
    // must not start (ADR-0009).
    if (env.NODE_ENV === 'production') {
      const missing = this.strategies.flatMap((strategy) =>
        strategy.variables.filter((name) => env[name] === undefined),
      );
      throw new MailNotConfiguredError([...new Set(missing)]);
    }
    return this.disabled;
  }
}
