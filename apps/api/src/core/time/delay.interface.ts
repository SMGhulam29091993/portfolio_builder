/**
 * `IDelay` — waiting, behind a port, so the AI timeout and retry decorators are tested with a
 * manual clock instead of real time (`ai-design-studio.T05`; UT09, UT10).
 */
export interface IDelay {
  /**
   * Resolves `true` once `ms` have passed, or `false` as soon as `signal` aborts — never rejects,
   * so a cancelled wait cannot surface as an unhandled rejection.
   */
  wait(ms: number, signal?: AbortSignal): Promise<boolean>;
}
