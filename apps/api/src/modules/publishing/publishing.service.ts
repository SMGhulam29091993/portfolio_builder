/**
 * `IPublishingService` and `ISnapshotReader` (`publish-pipeline.T05`, `T06`; API01–API06). The
 * draft is assembled fresh for every call and never written here; a publish is the pipeline;
 * activation and retry move the same pointer and emit the same event. Every operation is
 * scoped to the signed-in user's portfolio (ADR-0010).
 */
import type { IEventPublisher } from '../../core/events/index.js';
import { ConflictError, NotFoundError } from '../../core/errors/index.js';
import type {
  IDraftAssembler,
  IPublishedPointerReader,
  IPublishedPointerWriter,
  IPublishingService,
  IPublishPipeline,
  IPublishRuleRegistry,
  ISnapshotReader,
  ISnapshotRepository,
} from './publishing.interface.js';
import type {
  ActivationResult,
  DraftScope,
  ListSnapshotsQuery,
  PointerState,
  PublishingEvents,
  PublishingStatus,
  PublishMeta,
  PublishRequest,
  PublishResult,
  RevalidationStatus,
  SnapshotPage,
  StoredSnapshot,
  ValidationReport,
} from './publishing.types.js';

export class PublishingService implements IPublishingService, ISnapshotReader {
  constructor(
    private readonly snapshots: ISnapshotRepository,
    private readonly drafts: IDraftAssembler,
    private readonly rules: IPublishRuleRegistry,
    private readonly pipeline: IPublishPipeline,
    private readonly pointers: IPublishedPointerReader & IPublishedPointerWriter,
    private readonly events: IEventPublisher<PublishingEvents>,
    private readonly clock: { now(): Date },
  ) {}

  async status(scope: DraftScope): Promise<PublishingStatus> {
    const [state, draft] = await Promise.all([this.pointerOf(scope.portfolioId), this.drafts.assemble(scope)]);
    const live = await this.liveSnapshot(state);
    return {
      published:
        live && state.pointer
          ? { version: live.version, publishedAt: state.pointer.publishedAt.toISOString(), contentHash: live.contentHash }
          : null,
      draft: { contentHash: draft.contentHash },
      hasUnpublishedChanges: live?.contentHash !== draft.contentHash,
      revalidation: live ? { status: live.delivery.status, at: (live.delivery.at ?? live.publishedAt).toISOString() } : null,
    };
  }

  async validate(scope: DraftScope): Promise<ValidationReport> {
    const draft = await this.drafts.assemble(scope);
    const issues = await this.rules.evaluate(draft.content);
    return {
      publishable: !issues.some((issue) => issue.severity === 'error'),
      draftContentHash: draft.contentHash,
      issues,
    };
  }

  async publish(scope: DraftScope, request: PublishRequest, meta: PublishMeta): Promise<PublishResult> {
    const [state, draft] = await Promise.all([this.pointerOf(scope.portfolioId), this.drafts.assemble(scope)]);
    if (draft.contentHash !== request.expectedDraftHash) {
      throw new ConflictError('DRAFT_CHANGED', { draftContentHash: draft.contentHash }, 'The draft changed since it was checked');
    }
    const live = await this.liveSnapshot(state);
    if (live?.contentHash === draft.contentHash) {
      throw new ConflictError('NOTHING_TO_PUBLISH', {}, 'The draft is already live');
    }
    const result = await this.pipeline.run({
      scope,
      slug: state.slug,
      content: draft.content,
      contentHash: draft.contentHash,
      note: request.note ?? null,
      previous: state.pointer,
      meta,
    });
    const { snapshot } = result;
    if (!snapshot) throw new Error('The publish pipeline returned no snapshot');
    return {
      snapshot: { version: snapshot.version, publishedAt: snapshot.publishedAt.toISOString(), contentHash: snapshot.contentHash },
      warnings: (result.issues ?? []).filter((issue) => issue.severity === 'warning'),
      revalidation: await this.deliveryOf(scope.portfolioId, snapshot.id),
    };
  }

  async history(portfolioId: string, { limit, cursor }: ListSnapshotsQuery): Promise<SnapshotPage> {
    const [state, rows] = await Promise.all([this.pointerOf(portfolioId), this.snapshots.list(portfolioId, limit + 1, cursor)]);
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      snapshots: page.map((row) => ({
        version: row.version,
        publishedAt: row.publishedAt.toISOString(),
        note: row.note,
        contentHash: row.contentHash,
        isCurrent: row.id === state.pointer?.snapshotId,
        revalidation: row.delivery.status,
      })),
      nextCursor: rows.length > limit && last ? String(last.version) : null,
    };
  }

  async activate(scope: DraftScope, version: number, meta: PublishMeta): Promise<ActivationResult> {
    const [state, snapshot] = await Promise.all([
      this.pointerOf(scope.portfolioId),
      this.snapshots.findByVersion(scope.portfolioId, version),
    ]);
    if (!snapshot) throw new NotFoundError('No snapshot with that version');
    if (state.pointer?.snapshotId === snapshot.id) {
      throw new ConflictError('ALREADY_CURRENT', {}, 'That version is already live');
    }
    const switched = await this.pointers.switchTo(scope.portfolioId, state.pointer?.snapshotId ?? null, {
      snapshotId: snapshot.id,
      version: snapshot.version,
      publishedAt: this.clock.now(),
    });
    if (!switched) throw new ConflictError('PUBLISH_CONFLICT', {}, 'Another publish changed the live version first');
    await this.emit(state, snapshot, meta);
    return {
      snapshot: { version: snapshot.version, contentHash: snapshot.contentHash },
      revalidation: await this.deliveryOf(scope.portfolioId, snapshot.id),
    };
  }

  async revalidate(scope: DraftScope, meta: PublishMeta): Promise<RevalidationStatus> {
    const state = await this.pointerOf(scope.portfolioId);
    const live = await this.liveSnapshot(state);
    if (!live) throw new ConflictError('NOTHING_PUBLISHED', {}, 'Nothing is published yet');
    await this.emit(state, live, meta);
    return this.deliveryOf(scope.portfolioId, live.id);
  }

  async getCurrentForSlug(slug: string): Promise<StoredSnapshot | null> {
    const state = await this.pointers.findBySlug(slug);
    return state ? this.liveSnapshot(state) : null;
  }

  private async pointerOf(portfolioId: string): Promise<PointerState> {
    const state = await this.pointers.read(portfolioId);
    if (!state) throw new NotFoundError('Portfolio not found');
    return state;
  }

  private async liveSnapshot(state: PointerState): Promise<StoredSnapshot | null> {
    return state.pointer ? this.snapshots.findById(state.portfolioId, state.pointer.snapshotId) : null;
  }

  private emit(state: PointerState, snapshot: StoredSnapshot, meta: PublishMeta): Promise<void> {
    return this.events.publish(
      'portfolio.published',
      { portfolioId: state.portfolioId, slug: state.slug, snapshotId: snapshot.id, version: snapshot.version },
      meta,
    );
  }

  /** The recorded revalidation outcome; anything but a recorded `ok` reads as `failed`. */
  private async deliveryOf(portfolioId: string, snapshotId: string): Promise<RevalidationStatus> {
    const snapshot = await this.snapshots.findById(portfolioId, snapshotId);
    return snapshot?.delivery.status === 'ok' ? 'ok' : 'failed';
  }
}
