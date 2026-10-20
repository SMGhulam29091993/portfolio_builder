/**
 * Where each publish issue is fixed (`publish-pipeline.AC19`): the issue's `path` names the
 * part of the content, and each part has one CMS screen.
 */
import type { PublishIssue } from '@portfolio/contracts';

/** The CMS screen that edits the field at `path`. */
export function issueHref(path: string): string {
  const section = /^sections\.([a-z][a-z0-9-]*)/.exec(path)?.[1];
  if (section) return `/cms/sections/${section}`;
  if (path.startsWith('identity') || path.startsWith('assets')) return '/cms/identity';
  if (path.startsWith('design')) return '/cms/design';
  return '/cms';
}

/** The issue's field as a reader would say it: `work › projects 4 › description`. */
export function issueLocation(path: string): string {
  if (path === '') return 'The whole draft';
  return path
    .replace(/^sections\./, '')
    .replace(/\[(\d+)\]/g, (_, index: string) => ` ${String(Number(index) + 1)}`)
    .split('.')
    .join(' › ');
}

/** Issues split by severity, errors first. */
export function groupIssues(issues: readonly PublishIssue[]): { errors: PublishIssue[]; warnings: PublishIssue[] } {
  return {
    errors: issues.filter((issue) => issue.severity === 'error'),
    warnings: issues.filter((issue) => issue.severity === 'warning'),
  };
}
