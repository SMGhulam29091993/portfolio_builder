/**
 * Domain types of the `publishing` module (`publish-pipeline` plan → Data Model). Published
 * content, issues and request payloads are owned by `packages/contracts` and re-exported here.
 */
import type { Identity, PublishedContent, PublishIssue, RevalidationStatus, SnapshotSummary } from '@portfolio/contracts';

export {
  hasPlaceholder,
  listSnapshotsQuerySchema,
  publishedContentSchema,
  publishRequestSchema,
  SNAPSHOT_SCHEMA_VERSION,
  snapshotVersionParamsSchema,
  type ListSnapshotsQuery,
  type PublishedAsset,
  type PublishedContent,
  type PublishingStatus,
  type PublishIssue,
  type PublishRequest,
  type RevalidationStatus,
  type SnapshotSummary,
} from '@portfolio/contracts';

/** Whose draft is being read: the portfolio, and its user (the identity template needs the account). */
export interface DraftScope {
  readonly portfolioId: string;
  readonly userId: string;
}

/** One draft section as the `sections` contributor reports it — hidden ones included. */
export interface DraftSection {
  readonly type: string;
  readonly visible: boolean;
  readonly data: unknown;
}

/** The draft's sections and their render order (`hero` first, then `sectionOrder`). */
export interface SectionsDraft {
  readonly order: readonly string[];
  readonly sections: readonly DraftSection[];
}

/** The draft's design: theme tokens and one layout variant per section type. */
export interface DesignDraft {
  readonly theme: unknown;
  readonly layout: Readonly<Record<string, string>>;
}

/** What each contributor supplies, by key (`publish-pipeline` plan → `IDraftContributor`). */
export interface DraftParts {
  readonly sections: SectionsDraft;
  readonly identity: Identity;
  readonly design: DesignDraft;
}

export type DraftPartKey = keyof DraftParts;

/** The draft, built into the shape a snapshot stores, with its canonical hash. */
export interface AssembledDraft {
  readonly content: PublishedContent;
  readonly contentHash: string;
}

/** The revalidation outcome recorded on a snapshot (`publish-pipeline.AC12`). */
export interface DeliveryRecord {
  readonly status: RevalidationStatus;
  readonly at: Date | null;
  readonly attempts: number;
}

/** One stored snapshot. `content`, `contentHash` and `version` never change after insert. */
export interface StoredSnapshot {
  readonly id: string;
  readonly portfolioId: string;
  readonly version: number;
  readonly contentHash: string;
  readonly content: PublishedContent;
  readonly note: string | null;
  readonly publishedAt: Date;
  /** The `users` id that published it. */
  readonly publishedBy: string;
  readonly delivery: DeliveryRecord;
}

/** A snapshot without its content — the history listing (`publish-pipeline.API04`). */
export type SnapshotHeader = Omit<StoredSnapshot, 'content'>;

/** What inserting a snapshot needs; delivery starts `pending` with no attempts. */
export type NewSnapshot = Omit<StoredSnapshot, 'id' | 'delivery'>;

/** The live pointer stored on the portfolio. */
export interface PublishedPointer {
  readonly snapshotId: string;
  readonly version: number;
  readonly publishedAt: Date;
}

/** A published portfolio as the sitemap sees it (`public-site-rendering.API04`). */
export interface PublishedPortfolio {
  readonly slug: string;
  readonly publishedAt: Date;
}

/** A portfolio's slug and its live pointer (`null` before the first publish). */
export interface PointerState {
  readonly portfolioId: string;
  readonly slug: string;
  readonly pointer: PublishedPointer | null;
}

/** A design problem found at publish (`design-valid`), relative to the design. */
export interface DesignCheckIssue {
  readonly path: string;
  readonly message: string;
}

/** Correlation for logs and events; identifiers only. */
export interface PublishMeta {
  readonly requestId?: string;
}

/**
 * State passed through the publish steps (`publish-pipeline.UT07`). Each step returns the
 * context it received, plus what it added.
 */
export interface PublishContext {
  readonly scope: DraftScope;
  readonly slug: string;
  readonly content: PublishedContent;
  readonly contentHash: string;
  readonly note: string | null;
  /** The live pointer when the publish began; the compare-and-swap expects it unchanged. */
  readonly previous: PublishedPointer | null;
  readonly meta: PublishMeta;
  /** Set by `ValidateStep`: every issue, warnings included. */
  readonly issues?: readonly PublishIssue[];
  /** Set by `PersistSnapshotStep`. */
  readonly snapshot?: StoredSnapshot;
}

/** `portfolio.published` — after a successful pointer switch (publish or activate). */
export interface PortfolioPublishedEvent {
  readonly portfolioId: string;
  /** The free portfolio's path; the site revalidates this page only (ADR-0010). */
  readonly slug: string;
  readonly snapshotId: string;
  readonly version: number;
}

/** The events `publishing` emits; the container merges this into the bus's map. */
export interface PublishingEvents {
  readonly 'portfolio.published': PortfolioPublishedEvent;
}

/** A page of the history (`publish-pipeline.API04`). */
export interface SnapshotPage {
  readonly snapshots: readonly SnapshotSummary[];
  readonly nextCursor: string | null;
}

/** `publish-pipeline.API03` — data. */
export interface PublishResult {
  readonly snapshot: { readonly version: number; readonly publishedAt: string; readonly contentHash: string };
  readonly warnings: readonly PublishIssue[];
  readonly revalidation: RevalidationStatus;
}

/** `publish-pipeline.API02` — data. */
export interface ValidationReport {
  readonly publishable: boolean;
  readonly draftContentHash: string;
  readonly issues: readonly PublishIssue[];
}

/** `publish-pipeline.API05` — data. */
export interface ActivationResult {
  readonly snapshot: { readonly version: number; readonly contentHash: string };
  readonly revalidation: RevalidationStatus;
}
