/** `googleErrorMessage`, `formatWait`, `genericErrorMessage` — `cms-panel-shell.UT11` (AC19). */
import { describe, expect, it } from 'vitest';

import { ApiError } from '../api/client';
import { formatWait, genericErrorMessage, googleErrorMessage } from './messages';

describe('googleErrorMessage (cms-panel-shell.UT11)', () => {
  it.each(['google_unavailable', 'google_cancelled', 'google_state', 'google_failed', 'google_unverified', 'google_conflict'])(
    'has its own message for %s',
    (reason) => {
      expect(googleErrorMessage(reason)).not.toBe(googleErrorMessage('unknown'));
    },
  );

  it('falls back to a generic message for an unknown reason', () => {
    expect(googleErrorMessage('<script>')).toBe('Sign-in did not complete. Please try again.');
  });
});

describe('formatWait', () => {
  it.each([
    [0, '0 seconds'],
    [1, '1 second'],
    [59.2, '1 minute'],
    [60, '1 minute'],
    [65, '1 minute 5 seconds'],
    [900, '15 minutes'],
  ])('%d → %j', (seconds, text) => {
    expect(formatWait(seconds)).toBe(text);
  });
});

describe('genericErrorMessage', () => {
  it('maps by code, never by message text', () => {
    expect(genericErrorMessage(new ApiError(429, 'RATE_LIMITED', { retryAfterSec: 30 }, 'ignored'))).toBe(
      'Too many attempts. Try again in 30 seconds.',
    );
    expect(genericErrorMessage(new ApiError(0, 'NETWORK_ERROR'))).toMatch(/could not be reached/);
    expect(genericErrorMessage(new Error('x'))).toMatch(/Something went wrong/);
  });
});
