/**
 * Public surface of the `publishing` module: interfaces and types only. `portfolio`, `identity`
 * and `design` implement the draft and pointer ports declared here (ADR-0013); `public-site`
 * reads published content through `ISnapshotReader` only (draft isolation).
 */
export type {
  AnyDraftContributor,
  IDraftContributor,
  IPublishDesignCheck,
  IPublishedPointerReader,
  IPublishedPointerWriter,
  ISnapshotReader,
} from './publishing.interface.js';
export type {
  DesignCheckIssue,
  DesignDraft,
  DraftParts,
  DraftScope,
  DraftSection,
  PointerState,
  PortfolioPublishedEvent,
  PublishedContent,
  PublishedPointer,
  PublishingEvents,
  SectionsDraft,
  StoredSnapshot,
} from './publishing.types.js';
