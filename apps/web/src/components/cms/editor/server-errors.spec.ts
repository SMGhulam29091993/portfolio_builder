/** `issuesOf`, `applyServerIssues` — `cms-panel-shell.UT05` (AC6). */
import { describe, expect, it } from 'vitest';

import { applyServerIssues, issuesOf } from './server-errors';

describe('server validation errors (cms-panel-shell.UT05)', () => {
  it('sets each error on its field path and names the first to focus', () => {
    const set: [string, string][] = [];
    const first = applyServerIssues(
      issuesOf({ code: 'VALIDATION_FAILED', errors: [{ path: 'projects.1.title', message: 'Too long' }, { path: 'heading.lead', message: 'Required' }] }),
      (path, error) => set.push([path, error.message]),
    );

    expect(set).toEqual([
      ['projects.1.title', 'Too long'],
      ['heading.lead', 'Required'],
    ]);
    expect(first).toBe('projects.1.title');
  });

  it('ignores malformed issues and whole-input issues', () => {
    const set: string[] = [];
    const first = applyServerIssues(issuesOf({ errors: [{ path: '', message: 'Bad body' }, 'junk', { path: 3 }] }), (path) => set.push(path));

    expect(set).toEqual([]);
    expect(first).toBeUndefined();
    expect(issuesOf({})).toEqual([]);
  });
});
