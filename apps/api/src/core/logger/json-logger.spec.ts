import { describe, expect, it } from 'vitest';

import { JsonLogger } from './json-logger.js';

const FIXED_TIME = new Date('2026-10-15T12:00:00.000Z');

/** Builds a logger whose output is collected into `lines` as parsed objects. */
function createCapturingLogger(): { logger: JsonLogger; lines: Record<string, unknown>[] } {
  const lines: Record<string, unknown>[] = [];
  const sink = {
    write(line: string) {
      expect(line.endsWith('\n')).toBe(true);
      lines.push(JSON.parse(line) as Record<string, unknown>);
    },
  };
  return { logger: new JsonLogger(sink, () => FIXED_TIME), lines };
}

describe('JsonLogger', () => {
  it.each(['debug', 'info', 'warn', 'error'] as const)(
    'writes a %s entry as one JSON line with time, level, message and context',
    (level) => {
      const { logger, lines } = createCapturingLogger();

      logger[level]('server listening', { port: 4100 });

      expect(lines).toEqual([
        { time: FIXED_TIME.toISOString(), level, msg: 'server listening', port: 4100 },
      ]);
    },
  );

  it('expands an Error in context to name, message, stack and cause', () => {
    const { logger, lines } = createCapturingLogger();
    const cause = new Error('socket closed');
    const error = new Error('connect failed', { cause });

    logger.error('startup failed', { error });

    expect(lines[0]?.error).toEqual({
      name: 'Error',
      message: 'connect failed',
      stack: expect.stringContaining('connect failed') as unknown,
      cause: expect.objectContaining({ message: 'socket closed' }) as unknown,
    });
  });

  it('keeps the fixed fields when context uses the same keys', () => {
    const { logger, lines } = createCapturingLogger();

    logger.info('real message', { msg: 'overridden', level: 'error' });

    expect(lines[0]).toEqual(
      expect.objectContaining({ msg: 'real message', level: 'info' }),
    );
  });
});
