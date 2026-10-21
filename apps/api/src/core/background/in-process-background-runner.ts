/**
 * `InProcessBackgroundRunner` — `IBackgroundRunner` on the event loop. Tracks what is running so
 * tests (and a graceful shutdown, later) can wait for it with `idle()`.
 */
import type { ILogger } from '../logger/logger.interface.js';
import type { IBackgroundRunner } from './background-runner.interface.js';

export class InProcessBackgroundRunner implements IBackgroundRunner {
  private readonly running = new Set<Promise<void>>();

  constructor(private readonly logger: ILogger) {}

  run(label: string, task: () => Promise<void>): void {
    // Deferred to a later turn, so the caller's response is sent before the task starts work.
    const settled: Promise<void> = Promise.resolve()
      .then(task)
      .catch((error: unknown) => {
        this.logger.error('background task failed', { task: label, error });
      })
      .finally(() => this.running.delete(settled));
    this.running.add(settled);
  }

  /** Resolves once every task started so far has settled. */
  async idle(): Promise<void> {
    while (this.running.size > 0) await Promise.all([...this.running]);
  }
}
