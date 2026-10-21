/**
 * Step 5 — emits `portfolio.published` (`publish-pipeline.AC12`). The bus awaits its handlers
 * and swallows their failures, so revalidation is recorded before the response and can never
 * fail the publish.
 */
import type { IEventPublisher } from '../../../core/events/index.js';
import type { IPublishStep } from '../publishing.interface.js';
import type { PublishContext, PublishingEvents } from '../publishing.types.js';

export class EmitPublishedStep implements IPublishStep {
  constructor(private readonly events: IEventPublisher<PublishingEvents>) {}

  async run(context: PublishContext): Promise<PublishContext> {
    const { snapshot } = context;
    if (!snapshot) throw new Error('EmitPublishedStep needs the persisted snapshot');
    await this.events.publish(
      'portfolio.published',
      { portfolioId: context.scope.portfolioId, slug: context.slug, snapshotId: snapshot.id, version: snapshot.version },
      context.meta,
    );
    return context;
  }
}
