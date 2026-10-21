import type { IDelay } from '../../core/time/index.js';

/**
 * `IDelay` on a manual timeline (`ai-design-studio.T05`): waits settle only when `advance` passes
 * their deadline, so timeout and backoff tests take no real time.
 */
export class ManualDelay implements IDelay {
  private nowMs = 0;
  private waits: { deadline: number; resolve: (elapsed: boolean) => void }[] = [];
  /** Every requested wait, in order, for backoff assertions. */
  readonly requested: number[] = [];

  wait(ms: number, signal?: AbortSignal): Promise<boolean> {
    this.requested.push(ms);
    if (signal?.aborted) return Promise.resolve(false);
    return new Promise((resolve) => {
      const entry = { deadline: this.nowMs + ms, resolve };
      this.waits.push(entry);
      signal?.addEventListener(
        'abort',
        () => {
          this.waits = this.waits.filter((candidate) => candidate !== entry);
          resolve(false);
        },
        { once: true },
      );
    });
  }

  /** Moves time forward by `ms`, settling every wait whose deadline has passed. */
  async advance(ms: number): Promise<void> {
    this.nowMs += ms;
    const due = this.waits.filter((entry) => entry.deadline <= this.nowMs);
    this.waits = this.waits.filter((entry) => entry.deadline > this.nowMs);
    for (const entry of due) entry.resolve(true);
    // Lets the continuations of the settled waits run before the test looks.
    await new Promise((resolve) => setImmediate(resolve));
  }

  /** How many waits are still running. */
  get pending(): number {
    return this.waits.length;
  }
}
