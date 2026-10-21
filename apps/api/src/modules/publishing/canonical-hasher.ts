/**
 * `ICanonicalHasher` (`publish-pipeline.T03`; AC10): JSON with object keys sorted at every level
 * and no insignificant whitespace, hashed with SHA-256. Equal content hashes equally whatever
 * order keys were written or contributors ran in; any changed value changes the hash. Array
 * order is significant (it is the render order). `undefined` members are dropped, as JSON does.
 */
import { sha256Hex } from '../../core/crypto/sha256.js';
import type { ICanonicalHasher } from './publishing.interface.js';

export class CanonicalHasher implements ICanonicalHasher {
  hash(value: unknown): string {
    return sha256Hex(canonicalJson(value));
  }
}

/** The canonical JSON text of `value`. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item === undefined ? null : item)).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const members = Object.entries(value)
      .filter(([, member]) => member !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, member]) => `${JSON.stringify(key)}:${canonicalJson(member)}`);
    return `{${members.join(',')}}`;
  }
  // `JSON.stringify` returns `undefined` for `undefined` and functions, though typed `string`.
  const text = JSON.stringify(value) as string | undefined;
  return text ?? 'null';
}
