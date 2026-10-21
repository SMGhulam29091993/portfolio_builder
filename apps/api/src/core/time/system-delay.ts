/** `SystemDelay` — `IDelay` on the real timers. The timer does not keep the process alive. */
import type { IDelay } from './delay.interface.js';

export class SystemDelay implements IDelay {
  wait(ms: number, signal?: AbortSignal): Promise<boolean> {
    if (signal?.aborted) return Promise.resolve(false);
    return new Promise((resolve) => {
      const onAbort = () => {
        clearTimeout(timer);
        resolve(false);
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve(true);
      }, ms);
      timer.unref();
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }
}
