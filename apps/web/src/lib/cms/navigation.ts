/**
 * Where the CMS sends a browser after sign-in and on a lost session (`cms-panel-shell.AC1`,
 * `AC3`). Pure, so the open-redirect rule is unit-tested (`cms-panel-shell.UT01`).
 */

/** The CMS's home, where an unusable `next` lands. */
export const CMS_HOME = '/cms';

/** Paths reachable without a session. */
export const PUBLIC_CMS_PATHS: readonly string[] = [
  '/cms/login',
  '/cms/register',
  '/cms/verify',
  '/cms/forgot-password',
];

/**
 * Whether `pathname` is one of the signed-out screens, where a failed session check is the
 * expected answer rather than a lost session (`cms-panel-shell.AC21`, UT13).
 */
export function isPublicCmsPath(pathname: string): boolean {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return PUBLIC_CMS_PATHS.includes(path);
}

/** Notices the sign-in page knows how to show (`?notice=`). */
export type LoginNotice = 'signed-out-elsewhere' | 'password-updated' | 'signed-out';

/**
 * `next` when it is a same-origin path under `/cms`, otherwise `/cms`. Rejects absolute URLs,
 * protocol-relative `//host`, backslash tricks and paths outside the CMS (AC1, UT01).
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return CMS_HOME;
  let parsed: URL;
  try {
    parsed = new URL(next, 'https://cms.invalid');
  } catch {
    return CMS_HOME;
  }
  if (parsed.origin !== 'https://cms.invalid') return CMS_HOME;
  const path = parsed.pathname;
  if (path !== CMS_HOME && !path.startsWith(`${CMS_HOME}/`)) return CMS_HOME;
  if (PUBLIC_CMS_PATHS.includes(path)) return CMS_HOME;
  return `${path}${parsed.search}`;
}

/** The sign-in URL that brings the browser back to `current` afterwards. */
export function loginUrl(current: string, notice?: LoginNotice): string {
  const params = new URLSearchParams();
  const next = safeNext(current);
  if (next !== CMS_HOME) params.set('next', next);
  if (notice) params.set('notice', notice);
  const query = params.toString();
  return query ? `/cms/login?${query}` : '/cms/login';
}
