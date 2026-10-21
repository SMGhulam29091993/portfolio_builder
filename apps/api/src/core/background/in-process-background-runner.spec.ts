/**
 * `InProcessBackgroundRunner` (`ai-design-studio.T04`; AC1): returns before the task runs, and a
 * failing task is logged, never thrown to the caller.
 */
import { describe, expect, it } from 'vitest';

import { RecordingLogger } from '../../testing/index.js';
import { InProcessBackgroundRunner } from './in-process-background-runner.js';

describe('InProcessBackgroundRunner', () => {
  it('returns before the task starts, then runs it', async () => {
    const runner = new InProcessBackgroundRunner(new RecordingLogger());
    const events: string[] = [];
    runner.run('job', () => {
      events.push('ran');
      return Promise.resolve();
    });
    events.push('returned');
    await runner.idle();
    expect(events).toEqual(['returned', 'ran']);
  });

  it('logs a rejection under its label and keeps running others', async () => {
    const logger = new RecordingLogger();
    const runner = new InProcessBackgroundRunner(logger);
    let second = false;
    runner.run('broken', () => Promise.reject(new Error('boom')));
    runner.run('fine', () => {
      second = true;
      return Promise.resolve();
    });
    await runner.idle();
    expect(second).toBe(true);
    expect(logger.entries).toEqual([
      expect.objectContaining({ level: 'error', message: 'background task failed', context: expect.objectContaining({ task: 'broken' }) as unknown }),
    ]);
  });

  it('idle waits for tasks started by tasks', async () => {
    const runner = new InProcessBackgroundRunner(new RecordingLogger());
    let inner = false;
    runner.run('outer', () => {
      runner.run('inner', () => {
        inner = true;
        return Promise.resolve();
      });
      return Promise.resolve();
    });
    await runner.idle();
    expect(inner).toBe(true);
  });
});
