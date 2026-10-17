/**
 * Shared contract suites for the randomness and clock ports (`constitution.md` → Liskov
 * Substitution): `owner-auth.CT08` — `ISecureRandom` on `CryptoSecureRandom` and
 * `SequenceSecureRandom`; `owner-auth.CT09` — `IClock` on `SystemClock` and `ManualClock`.
 * The shapes asserted are the spec's: 256-bit refresh tokens and 128-bit `jti` (base64url),
 * 32-byte identifiers (hex), 6-digit codes.
 */
import { describe, expect, it } from 'vitest';

import { ManualClock, SequenceSecureRandom } from '../../../testing/index.js';
import type { IClock, ISecureRandom } from '../auth.interface.js';
import { CryptoSecureRandom } from './crypto-secure-random.js';
import { SystemClock } from './system-clock.js';

const randoms: readonly { name: string; create: () => ISecureRandom }[] = [
  { name: 'CryptoSecureRandom', create: () => new CryptoSecureRandom() },
  { name: 'SequenceSecureRandom', create: () => new SequenceSecureRandom() },
];

describe.each(randoms)('owner-auth.CT08 — ISecureRandom contract — $name', ({ create }) => {
  it('base64url: 32 bytes → 43 URL-safe characters (refresh token), 16 → 22 (jti)', () => {
    const random = create();

    expect(random.base64url(32)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(random.base64url(16)).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it('hex: 32 bytes → 64 lower-case hex characters (identifier)', () => {
    expect(create().hex(32)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('numericCode: exactly the requested number of decimal digits', () => {
    const random = create();

    for (let draw = 0; draw < 50; draw += 1) expect(random.numericCode(6)).toMatch(/^[0-9]{6}$/);
  });

  it('never repeats a value across consecutive calls', () => {
    const random = create();
    const tokens = new Set(Array.from({ length: 100 }, () => random.base64url(32)));
    const identifiers = new Set(Array.from({ length: 100 }, () => random.hex(32)));

    expect(tokens.size).toBe(100);
    expect(identifiers.size).toBe(100);
  });
});

describe('CryptoSecureRandom codes', () => {
  it('keeps leading zeros and reaches both ends of the range over many draws', () => {
    const random = new CryptoSecureRandom();
    const firstDigits = new Set(Array.from({ length: 2_000 }, () => random.numericCode(6)[0]));

    // Every leading digit 0-9 appears: codes are not drawn from 100000-999999 only.
    expect(firstDigits.size).toBe(10);
  });

  it.each([0, 15, 2.5])('refuses a code length of %j', (length) => {
    expect(() => new CryptoSecureRandom().numericCode(length)).toThrow(RangeError);
  });
});

const clocks: readonly { name: string; create: () => IClock }[] = [
  { name: 'SystemClock', create: () => new SystemClock() },
  { name: 'ManualClock', create: () => new ManualClock(new Date()) },
];

describe.each(clocks)('owner-auth.CT09 — IClock contract — $name', ({ create }) => {
  it('returns a valid Date close to real time, and a fresh object on each call', () => {
    const clock = create();
    const first = clock.now();

    expect(Number.isNaN(first.getTime())).toBe(false);
    expect(Math.abs(first.getTime() - Date.now())).toBeLessThan(1_000);
    expect(clock.now()).not.toBe(first);
  });

  it('never goes backwards between calls', () => {
    const clock = create();
    const first = clock.now().getTime();

    expect(clock.now().getTime()).toBeGreaterThanOrEqual(first);
  });
});

describe('ManualClock', () => {
  it('moves only when advanced or set', () => {
    const clock = new ManualClock(new Date('2026-01-01T00:00:00.000Z'));

    clock.advance(1_500);
    expect(clock.now().toISOString()).toBe('2026-01-01T00:00:01.500Z');

    clock.set(new Date('2026-02-01T00:00:00.000Z'));
    expect(clock.now().toISOString()).toBe('2026-02-01T00:00:00.000Z');
  });
});
