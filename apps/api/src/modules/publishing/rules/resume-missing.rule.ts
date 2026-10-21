/**
 * `resume-missing` (warning; `publish-pipeline` → Publish rules, IT09): no résumé is set, so the
 * nav shows no résumé button.
 */
import type { IPublishRule } from '../publishing.interface.js';
import type { PublishedContent, PublishIssue } from '../publishing.types.js';

export class ResumeMissingRule implements IPublishRule {
  readonly id = 'resume-missing';
  readonly severity = 'warning' as const;

  check(content: PublishedContent): Promise<PublishIssue[]> {
    if (content.identity.resume.assetId !== null) return Promise.resolve([]);
    return Promise.resolve([
      { rule: this.id, severity: this.severity, path: 'identity.resume.assetId', message: 'No résumé: the nav will show no résumé button' },
    ]);
  }
}
