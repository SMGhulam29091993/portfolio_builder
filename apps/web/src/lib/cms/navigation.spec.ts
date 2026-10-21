/** `safeNext` and `loginUrl` — `cms-panel-shell.UT01` (AC1); `isPublicCmsPath` — UT13 (AC21). */
import { describe, expect, it } from 'vitest';

import { isPublicCmsPath, loginUrl, safeNext } from './navigation';

describe('safeNext (cms-panel-shell.UT01)', () => {
  it.each([
    ['/cms/design', '/cms/design'],
    ['/cms/sections/about?tab=1', '/cms/sections/about?tab=1'],
    ['/cms', '/cms'],
    ['//evil.example', '/cms'],
    ['https://evil.example', '/cms'],
    ['/\\evil.example', '/cms'],
    ['/other', '/cms'],
    ['/cmsx', '/cms'],
    ['/cms/login', '/cms'],
    ['', '/cms'],
    [null, '/cms'],
    ['/cms/../admin', '/cms'],
  ])('%j → %j', (next, expected) => {
    expect(safeNext(next)).toBe(expected);
  });
});

describe('loginUrl', () => {
  it('carries a safe next and the notice', () => {
    expect(loginUrl('/cms/sections/about', 'signed-out-elsewhere')).toBe(
      '/cms/login?next=%2Fcms%2Fsections%2Fabout&notice=signed-out-elsewhere',
    );
    expect(loginUrl('/cms')).toBe('/cms/login');
    expect(loginUrl('https://evil.example')).toBe('/cms/login');
  });
});

describe('isPublicCmsPath (cms-panel-shell.UT13)', () => {
  it.each([
    ['/cms/login', true],
    ['/cms/register/', true],
    ['/cms/verify', true],
    ['/cms/forgot-password', true],
    ['/cms', false],
    ['/cms/design', false],
    ['/cms/login/extra', false],
    ['/', false],
  ])('%j → %j', (pathname, expected) => {
    expect(isPublicCmsPath(pathname)).toBe(expected);
  });
});
