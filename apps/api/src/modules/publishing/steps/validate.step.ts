/**
 * Step 1 — runs every rule and stops the publish on any `error` issue (`publish-pipeline.AC4`,
 * `AC5`): 422 `PUBLISH_BLOCKED` with every issue, before anything is written.
 */
import { PublishBlockedError } from '../publishing.errors.js';
import type { IPublishRuleRegistry, IPublishStep } from '../publishing.interface.js';
import type { PublishContext } from '../publishing.types.js';

export class ValidateStep implements IPublishStep {
  constructor(private readonly rules: IPublishRuleRegistry) {}

  async run(context: PublishContext): Promise<PublishContext> {
    const issues = await this.rules.evaluate(context.content);
    if (issues.some((issue) => issue.severity === 'error')) throw new PublishBlockedError(issues);
    return { ...context, issues };
  }
}
