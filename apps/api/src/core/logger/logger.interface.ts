/**
 * Logging port for `apps/api`.
 *
 * Every class that logs depends on `ILogger`, never on a concrete logger, so the sink can change
 * without touching callers (Dependency Inversion). What may be logged is restricted by
 * `constitution.md` → PII / logging rules: never secrets, tokens, passwords, cookies, prompt text
 * or email addresses. Callers are responsible for keeping those out of `context`.
 */

/** Structured fields attached to one log entry. Values must be JSON-serialisable. */
export type LogContext = Readonly<Record<string, unknown>>;

/** Severity of a log entry, lowest first. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ILogger {
  /** Diagnostic detail that is only useful while developing. */
  debug(message: string, context?: LogContext): void;
  /** A normal, expected event (startup step finished, request served). */
  info(message: string, context?: LogContext): void;
  /** Something unexpected that the process recovered from. */
  warn(message: string, context?: LogContext): void;
  /** A failure. Pass the caught value as `context.error`; it is serialised safely. */
  error(message: string, context?: LogContext): void;
}
