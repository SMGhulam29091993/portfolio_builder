/**
 * `no-placeholder-text` (error; `publish-pipeline` → Publish rules, AC4, AC21): any string holding
 * a bracketed upper-case instruction or a `[Your …]` template placeholder. Uses the shared
 * `PLACEHOLDER_PATTERN`, so the template and the rule cannot drift apart.
 */
import { stringsOf } from '../content-walker.js';
import type { IPublishRule } from '../publishing.interface.js';
import { hasPlaceholder, type PublishedContent, type PublishIssue } from '../publishing.types.js';

export class NoPlaceholderTextRule implements IPublishRule {
  readonly id = 'no-placeholder-text';
  readonly severity = 'error' as const;

  check(content: PublishedContent): Promise<PublishIssue[]> {
    return Promise.resolve(
      stringsOf(content)
        .filter(({ value }) => hasPlaceholder(value))
        .map(({ path }) => ({ rule: this.id, severity: this.severity, path, message: 'Replace the placeholder text in brackets' })),
    );
  }
}
