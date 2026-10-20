/**
 * `seo-incomplete` (warning; `publish-pipeline` → Publish rules, IT09): the search title or
 * description is empty.
 */
import type { IPublishRule } from '../publishing.interface.js';
import type { PublishedContent, PublishIssue } from '../publishing.types.js';

export class SeoIncompleteRule implements IPublishRule {
  readonly id = 'seo-incomplete';
  readonly severity = 'warning' as const;

  check(content: PublishedContent): Promise<PublishIssue[]> {
    const { title, description } = content.identity.seo;
    const issues: PublishIssue[] = [];
    if (title.trim() === '') issues.push(this.issue('identity.seo.title', 'The search title is empty'));
    if (description.trim() === '') issues.push(this.issue('identity.seo.description', 'The search description is empty'));
    return Promise.resolve(issues);
  }

  private issue(path: string, message: string): PublishIssue {
    return { rule: this.id, severity: this.severity, path, message };
  }
}
