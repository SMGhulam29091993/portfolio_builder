/** `safeNext` and `loginUrl` — `cms-panel-shell.UT01` (AC1). */
import { describe, expect, it } from 'vitest';

import { loginUrl, safeNext } from './navigation';

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
