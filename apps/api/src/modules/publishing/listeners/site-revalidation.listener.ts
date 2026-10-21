/**
 * Reacts to `portfolio.published` (`publish-pipeline.T07`; AC12, UT10) — Observer: asks the web
 * app to re-render the portfolio's page and records the outcome on the snapshot. Never throws:
 * a failure is recorded and logged with the request id, and the publish still succeeds.
 */
import type { DomainEvent, IEventHandler } from '../../../core/events/index.js';
import type { ILogger } from '../../../core/logger/logger.interface.js';
import type { IRevalidationClient, ISnapshotRepository } from '../publishing.interface.js';
import type { PublishingEvents } from '../publishing.types.js';

export class SiteRevalidationListener implements IEventHandler<PublishingEvents, 'portfolio.published'> {
  constructor(
    private readonly client: IRevalidationClient,
    private readonly snapshots: Pick<ISnapshotRepository, 'updateDelivery'>,
    private readonly clock: { now(): Date },
    private readonly logger: ILogger,
  ) {}

  async handle({ payload, meta }: DomainEvent<PublishingEvents, 'portfolio.published'>): Promise<void> {
    const { portfolioId, slug, snapshotId, version } = payload;
    try {
      const status = await this.client.revalidate(slug);
      if (status === 'failed') this.logger.warn('site revalidation failed', { requestId: meta.requestId, version });
      await this.snapshots.updateDelivery(portfolioId, snapshotId, { status, at: this.clock.now() });
    } catch (error) {
      this.logger.error('recording site revalidation failed', { requestId: meta.requestId, version, error });
    }
  }
}
