import { describe, expect, it } from 'vitest';

import { parseCookieHeader } from './cookies.js';

describe('parseCookieHeader', () => {
  it('reads every name=value pair, trimming the separators', () => {
    const cookies = parseCookieHeader('a=1; b=two ;c=3');

    expect(Object.fromEntries(cookies)).toEqual({ a: '1', b: 'two', c: '3' });
  });

  it('returns an empty map for an absent or empty header', () => {
    expect(parseCookieHeader(undefined).size).toBe(0);
    expect(parseCookieHeader('').size).toBe(0);
  });

  it('keeps the first of two cookies with one name — the browser sends the most specific path first', () => {
    expect(parseCookieHeader('jti=newer; jti=older').get('jti')).toBe('newer');
  });

  it('decodes percent-encoding and strips surrounding double quotes', () => {
    const cookies = parseCookieHeader('a=x%3Dy; b="quoted"');

    expect(cookies.get('a')).toBe('x=y');
    expect(cookies.get('b')).toBe('quoted');
  });

  it('skips pairs it cannot read instead of throwing: no name, no "=", an empty value, bad encoding', () => {
    const cookies = parseCookieHeader('=orphan; flag; empty=; bad=%E0%A4%A; ok=1');

    expect(Object.fromEntries(cookies)).toEqual({ ok: '1' });
  });

  it('keeps the dots, dashes and underscores of a JWT and base64url values as they are', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig-_value';

    expect(parseCookieHeader(`access-token=${jwt}`).get('access-token')).toBe(jwt);
  });
});
