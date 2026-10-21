/**
 * `CanonicalHasher` (`publish-pipeline.UT06`; AC10) and its data variations.
 */
import { describe, expect, it } from 'vitest';

import { cleanContent } from '../../testing/index.js';
import { CanonicalHasher, canonicalJson } from './canonical-hasher.js';

const hasher = new CanonicalHasher();

/** The same value with every object's keys in reverse order. */
function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).reverse().map(([key, member]) => [key, reverseKeys(member)]));
  }
  return value;
}

describe('publish-pipeline.UT06 — canonical hashing', () => {
  it('is equal for the same content with shuffled keys, and differs for one changed value', () => {
    const content = cleanContent();
    expect(hasher.hash(reverseKeys(content))).toBe(hasher.hash(content));
    const changed = cleanContent();
    changed.identity.fullName = `${changed.identity.fullName}.`;
    expect(hasher.hash(changed)).not.toBe(hasher.hash(content));
    expect(hasher.hash(content)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('data variations: unicode, empty arrays vs missing keys, numbers vs numeric strings, array order', () => {
    expect(hasher.hash({ name: 'Résumé — 東京' })).toBe(hasher.hash({ name: 'Résumé — 東京' }));
    expect(hasher.hash({ name: 'Resume' })).not.toBe(hasher.hash({ name: 'Résumé' }));
    expect(hasher.hash({ tags: [] })).not.toBe(hasher.hash({}));
    expect(hasher.hash({ a: undefined, b: 1 })).toBe(hasher.hash({ b: 1 }));
    expect(hasher.hash({ value: 1 })).not.toBe(hasher.hash({ value: '1' }));
    expect(hasher.hash([1, 2])).not.toBe(hasher.hash([2, 1]));
  });

  it('writes compact JSON with sorted keys at every level', () => {
    expect(canonicalJson({ b: [{ d: 1, c: null }, undefined], a: 'x' })).toBe('{"a":"x","b":[{"c":null,"d":1},null]}');
    expect(canonicalJson(undefined)).toBe('null');
  });
});
