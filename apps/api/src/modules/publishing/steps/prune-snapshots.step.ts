/**
 * Step 4 — ADR-0004 retention (`publish-pipeline.AC20`): after the switch, deletes snapshots
 * older than the newest `keep`, never the live one. A failure is logged and never fails the
 * publish — the switch has already committed it.
 */
import type { ILogger } from '../../../core/logger/logger.interface.js';
import type { IPublishStep, ISnapshotRepository } from '../publishing.interface.js';
import type { PublishContext } from '../publishing.types.js';

export class PruneSnapshotsStep implements IPublishStep {
  constructor(
    private readonly snapshots: ISnapshotRepository,
    private readonly logger: ILogger,
    private readonly keep: number,
  ) {}

  async run(context: PublishContext): Promise<PublishContext> {
    const { snapshot } = context;
    if (!snapshot) return context;
    try {
      await this.snapshots.pruneOutsideWindow(context.scope.portfolioId, this.keep, snapshot.id);
    } catch (error) {
      this.logger.warn('snapshot pruning failed', { requestId: context.meta.requestId, error });
    }
    return context;
  }
}
