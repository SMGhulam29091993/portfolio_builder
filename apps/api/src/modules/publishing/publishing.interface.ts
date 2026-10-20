/**
 * Contracts of the `publishing` module, owned on the consuming side and role-sized
 * (`publish-pipeline` plan → Architecture Approach). `publishing` owns every port it shares with
 * `portfolio`, `identity` and `design` (ADR-0013) — they implement them and the container hands
 * them in — so this module imports none of their classes.
 */
import type {
  ActivationResult,
  AssembledDraft,
  DesignCheckIssue,
  DraftPartKey,
  DraftParts,
  DraftScope,
  ListSnapshotsQuery,
  NewSnapshot,
  PointerState,
  PublishContext,
  PublishedContent,
  PublishedPointer,
  PublishIssue,
  PublishingStatus,
  PublishMeta,
  PublishRequest,
  PublishResult,
  RevalidationStatus,
  SnapshotHeader,
  SnapshotPage,
  StoredSnapshot,
  ValidationReport,
} from './publishing.types.js';

/**
 * The `snapshots` collection (`publish-pipeline.AC14`). Append-only for content: nothing here
 * can change `content`, `contentHash` or `version`, and the one delete is the retention prune,
 * which never removes the live snapshot or one of the newest `keep`. Scoped by `portfolioId`.
 */
export interface ISnapshotRepository {
  /**
   * Inserts a snapshot with `delivery: pending`.
   *
   * @throws {ConflictError} `SNAPSHOT_VERSION_TAKEN` — another publish took this version.
   */
  insert(snapshot: NewSnapshot): Promise<StoredSnapshot>;
  /** The highest version of the portfolio, or 0 when it has none. */
  latestVersion(portfolioId: string): Promise<number>;
  findById(portfolioId: string, snapshotId: string): Promise<StoredSnapshot | null>;
  findByVersion(portfolioId: string, version: number): Promise<StoredSnapshot | null>;
  /** Newest first, without content; versions below `beforeVersion` when given. */
  list(portfolioId: string, limit: number, beforeVersion?: number): Promise<SnapshotHeader[]>;
  /**
   * Records a revalidation attempt: sets `status` and `at`, increments `attempts`.
   *
   * @returns `false` when the snapshot does not exist (pruned meanwhile).
   */
  updateDelivery(portfolioId: string, snapshotId: string, outcome: { status: RevalidationStatus; at: Date }): Promise<boolean>;
  /** Whether any snapshot of the portfolio lists the asset (`publish-pipeline.AC18`). */
  referencesAsset(portfolioId: string, assetId: string): Promise<boolean>;
  /**
   * ADR-0004 retention (`publish-pipeline.AC20`): deletes the portfolio's snapshots older than
   * its newest `keep`, except `liveSnapshotId`.
   *
   * @returns How many were deleted.
   */
  pruneOutsideWindow(portfolioId: string, keep: number, liveSnapshotId: string): Promise<number>;
}

/**
 * One part of the draft (Dependency Inversion: implemented by `portfolio`, `identity` and
 * `design`, each in its own folder). Read-only.
 */
export interface IDraftContributor<K extends DraftPartKey = DraftPartKey> {
  readonly key: K;
  collect(scope: DraftScope): Promise<DraftParts[K]>;
}

/** Any contributor, whatever its key — the list the container hands to `DraftAssembler`. */
export type AnyDraftContributor = { [K in DraftPartKey]: IDraftContributor<K> }[DraftPartKey];

/** Moves the live pointer; implemented by `portfolio`, the only writer of `portfolios`. */
export interface IPublishedPointerWriter {
  /**
   * Compare-and-swap: switches to `next` only while the live snapshot is still `expectedSnapshotId`
   * (`null` = nothing published yet). This switch is the publish's commit (ADR-0004).
   *
   * @returns `false` when the pointer changed meanwhile (`PUBLISH_CONFLICT`).
   */
  switchTo(portfolioId: string, expectedSnapshotId: string | null, next: PublishedPointer): Promise<boolean>;
}

/** Reads the live pointer; implemented by `portfolio`. */
export interface IPublishedPointerReader {
  /** @returns `null` when the portfolio does not exist. */
  read(portfolioId: string): Promise<PointerState | null>;
  /** Resolves a free portfolio's slug (`public-site`). @returns `null` when no portfolio has it. */
  findBySlug(slug: string): Promise<PointerState | null>;
}

/** The design verdict at publish (`design-valid`); implemented by `design`. */
export interface IPublishDesignCheck {
  /** Every problem with the design, and every visible section without a layout variant. */
  check(design: unknown, visibleSectionTypes: readonly string[]): DesignCheckIssue[];
}

/** Canonical JSON (sorted keys, no whitespace) hashed with SHA-256 (`publish-pipeline.AC10`). */
export interface ICanonicalHasher {
  /** 64 lower-case hex characters. Equal for equal content whatever the key order. */
  hash(value: unknown): string;
}

/** The asset metadata the builder copies into a snapshot; `assets` supplies it. */
export interface IPublishedAssetSource {
  findById(portfolioId: string, assetId: string): Promise<{
    id: string;
    kind: 'resume' | 'image';
    filename: string;
    mime: string;
    sizeBytes: number;
    sha256: string;
  } | null>;
}

/** Turns the draft's parts into published content (Builder; `publish-pipeline.AC9`). */
export interface ISnapshotBuilder {
  build(portfolioId: string, parts: DraftParts): Promise<PublishedContent>;
}

/** Collects every part from the contributors and builds the content with its hash. */
export interface IDraftAssembler {
  assemble(scope: DraftScope): Promise<AssembledDraft>;
}

/** One publish rule (Strategy; `publish-pipeline` → Publish rules). */
export interface IPublishRule {
  readonly id: string;
  readonly severity: 'error' | 'warning';
  check(content: PublishedContent): Promise<PublishIssue[]>;
}

/** Runs every registered rule (Registry; `publish-pipeline.AC17`). */
export interface IPublishRuleRegistry {
  /** Every issue from every rule; a rule that throws becomes an `error` issue named after it. */
  evaluate(content: PublishedContent): Promise<PublishIssue[]>;
}

/** One stage of a publish. */
export interface IPublishStep {
  run(context: PublishContext): Promise<PublishContext>;
}

/** Runs the steps in order; the first that throws stops the rest (`publish-pipeline.UT08`). */
export interface IPublishPipeline {
  run(context: PublishContext): Promise<PublishContext>;
}

/** Tells the web app to re-render a portfolio's page (`public-site-rendering.API03`). */
export interface IRevalidationClient {
  /** Never throws: a failure or timeout resolves to `failed`. */
  revalidate(slug: string): Promise<'ok' | 'failed'>;
}

/** `publish-pipeline.API01`–`API06`, on one portfolio. */
export interface IPublishingService {
  status(scope: DraftScope): Promise<PublishingStatus>;
  /** Writes nothing (`publish-pipeline.AC2`). */
  validate(scope: DraftScope): Promise<ValidationReport>;
  /**
   * @throws {ConflictError} `DRAFT_CHANGED`, `NOTHING_TO_PUBLISH` or `PUBLISH_CONFLICT`.
   * @throws {PublishBlockedError} At least one `error` issue (422).
   */
  publish(scope: DraftScope, request: PublishRequest, meta: PublishMeta): Promise<PublishResult>;
  history(portfolioId: string, query: ListSnapshotsQuery): Promise<SnapshotPage & { currentVersion: number | null }>;
  /**
   * @throws {NotFoundError} No snapshot with that version.
   * @throws {ConflictError} `ALREADY_CURRENT` or `PUBLISH_CONFLICT`.
   */
  activate(scope: DraftScope, version: number, meta: PublishMeta): Promise<ActivationResult>;
  /** @throws {ConflictError} `NOTHING_PUBLISHED`. */
  revalidate(scope: DraftScope, meta: PublishMeta): Promise<RevalidationStatus>;
}

/** What `public-site` may read: the live snapshot only, never the draft (draft isolation). */
export interface ISnapshotReader {
  /** The live snapshot of the portfolio at `slug`, or `null` when unknown or unpublished. */
  getCurrentForSlug(slug: string): Promise<StoredSnapshot | null>;
}

