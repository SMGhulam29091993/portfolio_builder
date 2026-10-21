/**
 * `IBackgroundRunner` (`ai-design-studio` plan → Architecture Approach): starts work the HTTP
 * response does not wait for (AC1). In-process only — a durable queue would need an ADR
 * (`ai-design-studio` plan → Explicitly Deferred); startup recovery covers the one way
 * in-process work is lost, a restart.
 */
export interface IBackgroundRunner {
  /**
   * Starts `task` and returns at once. A rejection is logged under `label`, never thrown to the
   * caller — the task is expected to record its own failure first.
   */
  run(label: string, task: () => Promise<void>): void;
}
