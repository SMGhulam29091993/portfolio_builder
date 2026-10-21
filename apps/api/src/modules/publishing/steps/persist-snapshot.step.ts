/**
 * Step 2 — inserts the snapshot with the next version (`publish-pipeline` plan → version
 * allocation): `latest + 1`, retried a bounded number of times when a racing publish took it
 * (AC16). Insert comes before the switch, so a crash between them leaves the live site as it was
 * (AC15).
 */
import { ConflictError } from '../../../core/errors/index.js';
import type { IPublishStep, ISnapshotRepository } from '../publishing.interface.js';
import type { PublishContext } from '../publishing.types.js';

/** Attempts at a free version before giving up as a conflict. */
const MAX_ATTEMPTS = 3;

export class PersistSnapshotStep implements IPublishStep {
  constructor(
    private readonly snapshots: ISnapshotRepository,
    private readonly clock: { now(): Date },
  ) {}

  async run(context: PublishContext): Promise<PublishContext> {
    const { portfolioId, userId } = context.scope;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const version = (await this.snapshots.latestVersion(portfolioId)) + 1;
      try {
        const snapshot = await this.snapshots.insert({
          portfolioId,
          version,
          contentHash: context.contentHash,
          content: context.content,
          note: context.note,
          publishedAt: this.clock.now(),
          publishedBy: userId,
        });
        return { ...context, snapshot };
      } catch (error) {
        if (!(error instanceof ConflictError && error.code === 'SNAPSHOT_VERSION_TAKEN')) throw error;
      }
    }
    throw new ConflictError('PUBLISH_CONFLICT', {}, 'Another publish is in progress');
  }
}
