/**
 * `sections-all-hidden` (warning; `publish-pipeline` → Publish rules): only `hero` is visible.
 */
import type { IPublishRule } from '../publishing.interface.js';
import type { PublishedContent, PublishIssue } from '../publishing.types.js';

export class SectionsAllHiddenRule implements IPublishRule {
  readonly id = 'sections-all-hidden';
  readonly severity = 'warning' as const;

  check(content: PublishedContent): Promise<PublishIssue[]> {
    if (content.sections.some((section) => section.type !== 'hero')) return Promise.resolve([]);
    return Promise.resolve([
      { rule: this.id, severity: this.severity, path: 'sections', message: 'Every section except the hero is hidden' },
    ]);
  }
}
