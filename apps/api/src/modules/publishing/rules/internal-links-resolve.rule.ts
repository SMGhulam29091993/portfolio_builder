/**
 * `internal-links-resolve` (error; `publish-pipeline` → Publish rules, IT08): a `LinkTarget` of
 * kind `section` must point at a section that is published — visible and present.
 */
import { walkContent } from '../content-walker.js';
import type { IPublishRule } from '../publishing.interface.js';
import type { PublishedContent, PublishIssue } from '../publishing.types.js';

export class InternalLinksResolveRule implements IPublishRule {
  readonly id = 'internal-links-resolve';
  readonly severity = 'error' as const;

  check(content: PublishedContent): Promise<PublishIssue[]> {
    const published = new Set(content.sections.map((section) => section.type));
    const issues: PublishIssue[] = [];
    walkContent(content, ({ value, path }) => {
      if (typeof value !== 'object' || value === null || !('kind' in value) || value.kind !== 'section') return;
      const target = 'sectionType' in value ? value.sectionType : undefined;
      if (typeof target === 'string' && published.has(target)) return;
      issues.push({ rule: this.id, severity: this.severity, path, message: 'Links to a section that is hidden or missing' });
    });
    return Promise.resolve(issues);
  }
}
