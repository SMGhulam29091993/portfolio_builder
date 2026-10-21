/** `SystemDelay` (`ai-design-studio.T05`): elapses, or stops early on abort without rejecting. */
import { describe, expect, it } from 'vitest';

import { SystemDelay } from './system-delay.js';

describe('SystemDelay', () => {
  it('resolves true once the time has passed', async () => {
    await expect(new SystemDelay().wait(5)).resolves.toBe(true);
  });

  it('resolves false when aborted, before or during the wait', async () => {
    const before = new AbortController();
    before.abort();
    await expect(new SystemDelay().wait(10_000, before.signal)).resolves.toBe(false);
    const during = new AbortController();
    const waiting = new SystemDelay().wait(10_000, during.signal);
    during.abort();
    await expect(waiting).resolves.toBe(false);
  });
});
