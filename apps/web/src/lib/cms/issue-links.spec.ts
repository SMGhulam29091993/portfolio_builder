/** Issue deep links (`publish-pipeline.AC19`). */
import { describe, expect, it } from 'vitest';

import { groupIssues, issueHref, issueLocation } from './issue-links';

describe('issue links', () => {
  it.each([
    ['sections.work.projects[3].description', '/cms/sections/work'],
    ['sections.hero', '/cms/sections/hero'],
    ['identity.resume.assetId', '/cms/identity'],
    ['assets', '/cms/identity'],
    ['design.theme.colors.text', '/cms/design'],
    ['sections', '/cms'],
    ['', '/cms'],
  ])('%s → %s', (path, href) => {
    expect(issueHref(path)).toBe(href);
  });

  it('reads a path as a location, counting from 1', () => {
    expect(issueLocation('sections.work.projects[3].description')).toBe('work › projects 4 › description');
    expect(issueLocation('identity.seo.title')).toBe('identity › seo › title');
    expect(issueLocation('')).toBe('The whole draft');
  });

  it('groups errors before warnings', () => {
    const issue = (severity: 'error' | 'warning') => ({ rule: 'r', severity, path: '', message: 'm' });
    expect(groupIssues([issue('warning'), issue('error')])).toEqual({ errors: [issue('error')], warnings: [issue('warning')] });
  });
});
