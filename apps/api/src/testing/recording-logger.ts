/**
 * In-memory `ILogger` fake: keeps every entry so a test can assert on what was (and was not)
 * logged, and stays silent so test output is not flooded with JSON lines.
 *
 * Use it for log assertions — including that no secret, token or email address reaches the
 * log (`constitution.md` → PII / logging rules) — and as the quiet logger for wiring tests.
 */
import type { ILogger, LogContext, LogLevel } from '../core/logger/logger.interface.js';

/** One recorded call. `context` is omitted when the caller passed none. */
export interface RecordedLogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly context?: LogContext;
}

export class RecordingLogger implements ILogger {
  private readonly recorded: RecordedLogEntry[] = [];

  /** Every entry so far, oldest first. */
  get entries(): readonly RecordedLogEntry[] {
    return this.recorded;
  }

  debug(message: string, context?: LogContext): void {
    this.record('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.record('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.record('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.record('error', message, context);
  }

  private record(level: LogLevel, message: string, context: LogContext | undefined): void {
    this.recorded.push(context === undefined ? { level, message } : { level, message, context });
  }
}
