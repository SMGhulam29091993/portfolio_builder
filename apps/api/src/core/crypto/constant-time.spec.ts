/** `constantTimeEquals` — `account-registration.UT02`. */
import { describe, expect, it } from 'vitest';

import { constantTimeEquals } from './constant-time.js';

describe('constantTimeEquals (account-registration.UT02)', () => {
  it('is true only for identical strings', () => {
    expect(constantTimeEquals('s3cret-value', 's3cret-value')).toBe(true);
    expect(constantTimeEquals('s3cret-value', 's3cret-valuE')).toBe(false);
  });

  it('compares values of different lengths without throwing', () => {
    expect(constantTimeEquals('short', 'a much longer configured secret')).toBe(false);
    expect(constantTimeEquals('', 'x')).toBe(false);
  });
});
