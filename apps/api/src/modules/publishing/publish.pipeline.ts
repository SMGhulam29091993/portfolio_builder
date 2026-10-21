/**
 * `IPublishPipeline` (`publish-pipeline.T05`; UT07, UT08) — Pipeline: the steps run in the order
 * the container lists them, each receiving what the previous returned. The first step that
 * throws stops the rest, so a blocked publish writes nothing and a failed switch emits nothing.
 */
import type { IPublishPipeline, IPublishStep } from './publishing.interface.js';
import type { PublishContext } from './publishing.types.js';

export class PublishPipeline implements IPublishPipeline {
  constructor(private readonly steps: readonly IPublishStep[]) {}

  async run(context: PublishContext): Promise<PublishContext> {
    let current = context;
    for (const step of this.steps) current = await step.run(current);
    return current;
  }
}
