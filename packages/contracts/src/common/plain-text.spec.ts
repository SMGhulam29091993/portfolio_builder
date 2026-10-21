/**
 * `plainText` — the shared free-text helper (`account-registration.T01`; data variations in
 * `account-registration.test_cases.md`). Section payloads rely on the same cases.
 */
import { describe, expect, it } from 'vitest';

import { cleanPlainText, plainText } from './plain-text.js';

describe('cleanPlainText', () => {
  it.each([
    ['<b>Ann</b>', 'Ann'],
    ['Ann <script>alert(1)</script>', 'Ann alert(1)'],
    ['<img src=x onerror=alert(1)>Ann', 'Ann'],
    ['A <!-- note --> B', 'A B'],
    ['  spaced   out  ', 'spaced out'],
    ['line\none', 'line one'],
    ['zero\u0000width‮flip', 'zerowidthflip'],
    ['5 < 6 and 7 > 3', '5 < 6 and 7 > 3'],
  ])('cleans %j to %j', (input, expected) => {
    expect(cleanPlainText(input)).toBe(expected);
  });

  it('keeps single blank lines in multiline mode and collapses longer runs', () => {
    expect(cleanPlainText(' one \r\n two\n\n\n\nthree ', true)).toBe('one\ntwo\n\nthree');
  });
});

describe('plainText', () => {
  const name = plainText(80);

  it('returns the cleaned value', () => {
    expect(name.parse('<b>Ann</b>')).toBe('Ann');
  });

  it.each([
    ['blank after cleaning', '   '],
    ['only tags', '<p></p>'],
    ['81 characters', 'a'.repeat(81)],
    ['not a string', 42],
  ])('rejects a value that is %s', (_case, value) => {
    expect(name.safeParse(value).success).toBe(false);
  });

  it('accepts exactly the maximum after cleaning', () => {
    expect(name.parse(` ${'a'.repeat(80)} `)).toHaveLength(80);
  });

  it('accepts an empty value when min is 0', () => {
    expect(plainText(10, { min: 0 }).parse('')).toBe('');
  });
});
