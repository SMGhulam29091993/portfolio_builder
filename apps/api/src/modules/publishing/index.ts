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
  ISnapshotRepository,
} from './publishing.interface.js';
export type {
  DesignCheckIssue,
  DesignDraft,
  DraftParts,
  DraftScope,
  DraftSection,
  NewSnapshot,
  PointerState,
  PortfolioPublishedEvent,
  PublishedContent,
  PublishedPointer,
  PublishingEvents,
  RevalidationStatus,
  SectionsDraft,
  SnapshotHeader,
  StoredSnapshot,
} from './publishing.types.js';
