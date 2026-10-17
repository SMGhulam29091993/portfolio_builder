/**
 * Reads a request's `Cookie` header (RFC 6265 §5.4 / §4.2).
 *
 * Express sets cookies itself (`res.cookie`) but has no reader, and a whole parsing middleware
 * would put every cookie of every request on `req` when only the auth cookie writer needs
 * three of them. A pure helper, so it lives in `core/` (`constitution.md` → Structural
 * non-negotiable).
 */

/**
 * Parses a `Cookie` header into name → value.
 *
 * - A browser sends the cookie with the most specific path first, so when a name repeats the
 *   first value wins.
 * - Values are percent-decoded (the inverse of `res.cookie`'s default encoding) and lose one
 *   pair of surrounding double quotes.
 * - A pair it cannot read — no `=`, no name, an empty value or malformed percent-encoding — is
 *   skipped, never thrown on: a broken cookie reads the same as a missing one.
 *
 * Never logs: cookie values are secrets (`constitution.md` → PII / logging rules).
 *
 * @param header - The raw header value; `undefined` when the request sent none.
 */
export function parseCookieHeader(header: string | undefined): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!header) return cookies;

  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=');
    if (separator === -1) continue;

    const name = pair.slice(0, separator).trim();
    if (!name || cookies.has(name)) continue;

    let raw = pair.slice(separator + 1).trim();
    if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1);

    const value = decode(raw);
    if (value) cookies.set(name, value);
  }

  return cookies;
}

/** Percent-decodes `raw`, or `undefined` when its encoding is malformed. */
function decode(raw: string): string | undefined {
  try {
    return decodeURIComponent(raw);
  } catch {
    return undefined;
  }
}
