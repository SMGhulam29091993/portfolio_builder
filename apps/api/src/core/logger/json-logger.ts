/**
 * `ILogger` implementation that writes one JSON object per line.
 *
 * Structured JSON is the log format required by `int-standards.express.md` → Logging. The sink
 * is injected so production writes to stdout and tests capture lines in memory.
 */
import type { ILogger, LogContext, LogLevel } from './logger.interface.js';

/** Where serialised log lines go. `process.stdout` satisfies this. */
export interface LogSink {
  write(line: string): unknown;
}

/** One serialised log entry, as written to the sink. */
interface LogEntry {
  readonly time: string;
  readonly level: LogLevel;
  readonly msg: string;
  readonly [field: string]: unknown;
}

export class JsonLogger implements ILogger {
  /**
   * @param sink - Receives each newline-terminated JSON line.
   * @param now - Clock used for the `time` field; injectable for deterministic tests.
   */
  constructor(
    private readonly sink: LogSink,
    private readonly now: () => Date = () => new Date(),
  ) {}

  debug(message: string, context?: LogContext): void {
    this.write('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.write('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.write('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.write('error', message, context);
  }

  /** Builds the entry and writes it as a single line. Fixed fields win over context keys. */
  private write(level: LogLevel, message: string, context: LogContext = {}): void {
    const entry: LogEntry = {
      ...serialiseContext(context),
      time: this.now().toISOString(),
      level,
      msg: message,
    };
    this.sink.write(`${JSON.stringify(entry)}\n`);
  }
}

/**
 * Makes context values JSON-safe. `Error` instances serialise to `{}` with `JSON.stringify`,
 * so they are expanded to name, message and stack. Logs are the one place a stack trace is
 * allowed to go — it never reaches an HTTP response (`monorepo-foundation.AC7`).
 */
function serialiseContext(context: LogContext): Record<string, unknown> {
  const serialised: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    serialised[key] = value instanceof Error ? serialiseError(value) : value;
  }
  return serialised;
}

function serialiseError(error: Error): Record<string, unknown> {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...(error.cause === undefined ? {} : { cause: serialiseCause(error.cause) }),
  };
}

function serialiseCause(cause: unknown): unknown {
  return cause instanceof Error ? serialiseError(cause) : cause;
}
