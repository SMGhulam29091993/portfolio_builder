/**
 * `IPublishRuleRegistry` (`publish-pipeline.T04`; AC17, UT12, UT13) — Registry over the
 * `IPublishRule` strategies. A new rule is one class and one line in the container; the
 * pipeline, the service and the other rules do not change. A rule that throws is reported as an
 * `error` issue named after it, so a broken rule blocks rather than silently passes.
 */
import type { ILogger } from '../../core/logger/logger.interface.js';
import type { IPublishRule, IPublishRuleRegistry } from './publishing.interface.js';
import type { PublishedContent, PublishIssue } from './publishing.types.js';

export class PublishRuleRegistry implements IPublishRuleRegistry {
  constructor(
    private readonly rules: readonly IPublishRule[],
    private readonly logger: ILogger,
  ) {
    const ids = new Set<string>();
    for (const rule of rules) {
      if (ids.has(rule.id)) throw new Error(`Publish rule "${rule.id}" is registered twice`);
      ids.add(rule.id);
    }
  }

  async evaluate(content: PublishedContent): Promise<PublishIssue[]> {
    const results = await Promise.all(
      this.rules.map(async (rule): Promise<PublishIssue[]> => {
        try {
          return await rule.check(content);
        } catch (error) {
          this.logger.error('publish rule failed', { rule: rule.id, error });
          return [{ rule: rule.id, severity: 'error', path: '', message: 'This check could not run; try again' }];
        }
      }),
    );
    return results.flat();
  }
}
