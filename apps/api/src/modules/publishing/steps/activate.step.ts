/**
 * Step 3 — the commit: switches the live pointer to the new snapshot with a compare-and-swap on
 * the pointer the publish started from (`publish-pipeline.AC3`, `AC16`). Losing the race is
 * 409 `PUBLISH_CONFLICT`; the inserted snapshot simply never goes live.
 */
import { ConflictError } from '../../../core/errors/index.js';
import type { IPublishedPointerWriter, IPublishStep } from '../publishing.interface.js';
import type { PublishContext } from '../publishing.types.js';

export class ActivateStep implements IPublishStep {
  constructor(private readonly pointers: IPublishedPointerWriter) {}

  async run(context: PublishContext): Promise<PublishContext> {
    const { snapshot } = context;
    if (!snapshot) throw new Error('ActivateStep needs the persisted snapshot');
    const switched = await this.pointers.switchTo(context.scope.portfolioId, context.previous?.snapshotId ?? null, {
      snapshotId: snapshot.id,
      version: snapshot.version,
      publishedAt: snapshot.publishedAt,
    });
    if (!switched) throw new ConflictError('PUBLISH_CONFLICT', {}, 'Another publish changed the live version first');
    return context;
  }
}
