/**
 * `PublishingService` with the real rules, steps and pipeline over in-memory ports
 * (`publish-pipeline.T05`, `T06`; UT09, UT11, AC1, AC3–AC8, AC11, AC13, AC15, AC16, AC20).
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { InProcessEventBus, type DomainEvent } from '../../core/events/index.js';
import {
  InMemoryPointerStore,
  InMemorySnapshotRepository,
  ManualClock,
  publishableContent,
  RecordingLogger,
  sectionData,
  SEED_PLACEHOLDER,
} from '../../testing/index.js';
import { CanonicalHasher } from './canonical-hasher.js';
import { PublishRuleRegistry } from './publish-rule.registry.js';
import { PublishBlockedError } from './publishing.errors.js';
import { PublishPipeline } from './publish.pipeline.js';
import type { IDraftAssembler } from './publishing.interface.js';
import { PublishingService } from './publishing.service.js';
import type { PublishedContent, PublishingEvents, RevalidationStatus } from './publishing.types.js';
import { AssetsResolveRule } from './rules/assets-resolve.rule.js';
import { DesignValidRule } from './rules/design-valid.rule.js';
import { FillerTextRule } from './rules/filler-text.rule.js';
import { InternalLinksResolveRule } from './rules/internal-links-resolve.rule.js';
import { LinksValidRule } from './rules/links-valid.rule.js';
import { NoPlaceholderTextRule } from './rules/no-placeholder-text.rule.js';
import { ResumeMissingRule } from './rules/resume-missing.rule.js';
import { SectionsAllHiddenRule } from './rules/sections-all-hidden.rule.js';
import { SeoIncompleteRule } from './rules/seo-incomplete.rule.js';
import { ActivateStep } from './steps/activate.step.js';
import { EmitPublishedStep } from './steps/emit-published.step.js';
import { PersistSnapshotStep } from './steps/persist-snapshot.step.js';
import { PruneSnapshotsStep } from './steps/prune-snapshots.step.js';
import { ValidateStep } from './steps/validate.step.js';

const scope = { portfolioId: 'p1', userId: 'u1' };
const hasher = new CanonicalHasher();

let draft: PublishedContent;
let snapshots: InMemorySnapshotRepository;
let pointers: InMemoryPointerStore;
let logger: RecordingLogger;
let events: DomainEvent<PublishingEvents, 'portfolio.published'>[];
let revalidation: RevalidationStatus;
let service: PublishingService;

/** The draft assembler reads whatever `draft` currently holds. */
const assembler: IDraftAssembler = {
  assemble: () => {
    const content = structuredClone(draft);
    return Promise.resolve({ content, contentHash: hasher.hash(content) });
  },
};

beforeEach(() => {
  draft = publishableContent();
  snapshots = new InMemorySnapshotRepository();
  pointers = new InMemoryPointerStore();
  pointers.add('p1', 'ada');
  logger = new RecordingLogger();
  events = [];
  revalidation = 'ok';
  const clock = new ManualClock(new Date('2026-10-21T10:00:00.000Z'));
  const bus = new InProcessEventBus<PublishingEvents>(logger);
  // Stands in for `SiteRevalidationListener`: records the configured outcome on the snapshot.
  bus.subscribe('portfolio.published', {
    handle: async (event) => {
      events.push(event);
      await snapshots.updateDelivery(event.payload.portfolioId, event.payload.snapshotId, { status: revalidation, at: clock.now() });
    },
  });
  const rules = new PublishRuleRegistry(
    [
      new NoPlaceholderTextRule(),
      new LinksValidRule(),
      new InternalLinksResolveRule(),
      new AssetsResolveRule(),
      new DesignValidRule({ check: () => [] }),
      new FillerTextRule(),
      new ResumeMissingRule(),
      new SeoIncompleteRule(),
      new SectionsAllHiddenRule(),
    ],
    logger,
  );
  const pipeline = new PublishPipeline([
    new ValidateStep(rules),
    new PersistSnapshotStep(snapshots, clock),
    new ActivateStep(pointers),
    new PruneSnapshotsStep(snapshots, logger, 20),
    new EmitPublishedStep(bus),
  ]);
  service = new PublishingService(snapshots, assembler, rules, pipeline, pointers, bus, clock);
});

/** Validates, then publishes with the hash validation returned. */
async function publish(note?: string) {
  const { draftContentHash } = await service.validate(scope);
  return service.publish(scope, { expectedDraftHash: draftContentHash, note }, { requestId: 'req-1' });
}

/** Replaces the description of the work section's project at `index`. */
function setProjectDescription(index: number, text: string): void {
  const project = (sectionData(draft, 'work') as { projects: { description: string }[] }).projects[index];
  if (!project) throw new Error('fixture');
  project.description = text;
}

/** Makes the draft different from what is live. */
function edit(text: string): void {
  draft.identity.roleTitle = text;
}

describe('status and validate', () => {
  it('publish-pipeline.AC1 — nothing published: published null, unpublished changes', async () => {
    expect(await service.status(scope)).toEqual({
      published: null,
      draft: { contentHash: hasher.hash(draft) },
      hasUnpublishedChanges: true,
      revalidation: null,
    });
  });

  it('publish-pipeline.AC2 — returns every issue and the hash, and writes nothing', async () => {
    setProjectDescription(3, SEED_PLACEHOLDER);
    draft.identity.resume.assetId = null;
    const report = await service.validate(scope);
    expect(report.publishable).toBe(false);
    expect(report.issues.map((issue) => issue.rule).sort()).toEqual(['no-placeholder-text', 'resume-missing']);
    expect(report.draftContentHash).toBe(hasher.hash(draft));
    expect(snapshots.all('p1')).toEqual([]);
  });

  it('throws NOT_FOUND for a portfolio without a pointer record', async () => {
    await expect(service.status({ portfolioId: 'nope', userId: 'u1' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('publish', () => {
  it('publish-pipeline.AC3 — inserts version 1, switches the pointer, emits once; status is then clean', async () => {
    const result = await publish('First');
    expect(result).toEqual({
      snapshot: { version: 1, publishedAt: '2026-10-21T10:00:00.000Z', contentHash: hasher.hash(draft) },
      warnings: [],
      revalidation: 'ok',
    });
    expect((await pointers.read('p1'))?.pointer?.version).toBe(1);
    expect(events.map((event) => event.payload)).toEqual([{ portfolioId: 'p1', slug: 'ada', snapshotId: 'snap-1', version: 1 }]);
    expect(events[0]?.meta.requestId).toBe('req-1');
    const status = await service.status(scope);
    expect(status.hasUnpublishedChanges).toBe(false);
    expect(status.published?.version).toBe(1);
    expect(status.revalidation?.status).toBe('ok');
    expect(snapshots.all('p1')[0]?.note).toBe('First');
  });

  it('publish-pipeline.AC4 — a placeholder blocks with 422 at its path; nothing is written', async () => {
    setProjectDescription(3, `Live. ${SEED_PLACEHOLDER}`);
    await expect(publish()).rejects.toMatchObject({
      status: 422,
      code: 'PUBLISH_BLOCKED',
      details: { issues: [expect.objectContaining({ rule: 'no-placeholder-text', path: 'sections.work.projects[3].description' })] },
    });
    expect(snapshots.all('p1')).toEqual([]);
    expect((await pointers.read('p1'))?.pointer).toBeNull();
    expect(events).toEqual([]);
  });

  it('publish-pipeline.AC5 — several error rules are all listed in one response', async () => {
    draft.identity.roleTitle = '[ADD YOUR ROLE TITLE]';
    draft.assets = [];
    const error: unknown = await publish().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(PublishBlockedError);
    const { issues } = (error as PublishBlockedError).details as { issues: { rule: string }[] };
    expect(issues.map((issue) => issue.rule)).toEqual(expect.arrayContaining(['no-placeholder-text', 'assets-resolve']));
  });

  it('publish-pipeline.AC6 — warnings only: publishes and returns them', async () => {
    draft.identity.resume.assetId = null;
    draft.assets = [];
    const result = await publish();
    expect(result.warnings.map((issue) => issue.rule)).toEqual(['resume-missing']);
  });

  it('publish-pipeline.UT09 / AC7 — a stale hash is DRAFT_CHANGED with the current hash', async () => {
    const { draftContentHash } = await service.validate(scope);
    edit('Changed after validating');
    await expect(service.publish(scope, { expectedDraftHash: draftContentHash }, {})).rejects.toMatchObject({
      code: 'DRAFT_CHANGED',
      details: { draftContentHash: hasher.hash(draft) },
    });
    expect(snapshots.all('p1')).toEqual([]);
  });

  it('publish-pipeline.UT09 / AC8 — the live content again is NOTHING_TO_PUBLISH', async () => {
    await publish();
    await expect(publish()).rejects.toMatchObject({ code: 'NOTHING_TO_PUBLISH' });
  });

  it('publish-pipeline.AC11 — editing the draft leaves the snapshot unchanged and status dirty', async () => {
    await publish();
    const before = snapshots.all('p1')[0]?.content;
    edit('Edited');
    expect((await service.status(scope)).hasUnpublishedChanges).toBe(true);
    expect(snapshots.all('p1')[0]?.content).toEqual(before);
  });

  it('publish-pipeline.AC12 — a failed revalidation still publishes and reports failed', async () => {
    revalidation = 'failed';
    expect((await publish()).revalidation).toBe('failed');
    expect((await service.status(scope)).revalidation?.status).toBe('failed');
  });

  it('publish-pipeline.UT11 / AC15 — a failing switch after the insert: error, no event, old version live; a retry succeeds', async () => {
    await publish();
    edit('Second');
    pointers.failSwitchTimes = 1;
    await expect(publish()).rejects.toThrow('pointer write failed');
    expect(events).toHaveLength(1);
    expect((await pointers.read('p1'))?.pointer?.version).toBe(1);
    expect((await publish()).snapshot.version).toBe(3);
    expect((await pointers.read('p1'))?.pointer?.version).toBe(3);
  });

  it('publish-pipeline.AC16 — racing publishes: unique versions, one switch, one PUBLISH_CONFLICT', async () => {
    const { draftContentHash } = await service.validate(scope);
    const results = await Promise.allSettled([
      service.publish(scope, { expectedDraftHash: draftContentHash }, {}),
      service.publish(scope, { expectedDraftHash: draftContentHash }, {}),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected?.status === 'rejected' && rejected.reason).toMatchObject({ code: 'PUBLISH_CONFLICT' });
    const versions = snapshots.all('p1').map((row) => row.version);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it('gives up with PUBLISH_CONFLICT when every version attempt is taken', async () => {
    snapshots.versionTakenTimes = 3;
    await expect(publish()).rejects.toMatchObject({ code: 'PUBLISH_CONFLICT' });
  });

  it('publish-pipeline.AC20 — keeps the newest 20; a failing prune is logged and the publish succeeds', async () => {
    for (let index = 1; index <= 21; index += 1) {
      edit(`Version ${String(index)}`);
      await publish();
    }
    expect(snapshots.all('p1').map((row) => row.version).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 2));
    snapshots.failPrune = true;
    edit('Version 22');
    expect((await publish()).snapshot.version).toBe(22);
    expect(logger.entries.some((entry) => entry.message === 'snapshot pruning failed')).toBe(true);
  });
});

describe('history, activate, revalidate and the reader', () => {
  async function threeVersions(): Promise<void> {
    for (const text of ['One', 'Two', 'Three']) {
      edit(text);
      await publish(text);
    }
  }

  it('publish-pipeline.API04 — newest first with a cursor; the live one is marked', async () => {
    await threeVersions();
    const first = await service.history('p1', { limit: 2 });
    expect(first.snapshots.map((row) => [row.version, row.isCurrent, row.note])).toEqual([[3, true, 'Three'], [2, false, 'Two']]);
    expect(first.nextCursor).toBe('2');
    const second = await service.history('p1', { limit: 2, cursor: 2 });
    expect(second.snapshots.map((row) => row.version)).toEqual([1]);
    expect(second.nextCursor).toBeNull();
    expect(second.snapshots[0]?.revalidation).toBe('ok');
  });

  it('publish-pipeline.AC13 — activating v1 switches and emits; no content, snapshot or draft changes', async () => {
    await threeVersions();
    const before = snapshots.all('p1');
    const draftBefore = structuredClone(draft);
    const result = await service.activate(scope, 1, {});
    expect(result).toEqual({ snapshot: { version: 1, contentHash: before[0]?.contentHash }, revalidation: 'ok' });
    expect((await pointers.read('p1'))?.pointer?.version).toBe(1);
    expect(events.at(-1)?.payload.version).toBe(1);
    // Only `delivery` (the revalidation record) may change.
    const withoutDelivery = (rows: typeof before) => rows.map((row) => ({ ...row, delivery: null }));
    expect(withoutDelivery(snapshots.all('p1'))).toEqual(withoutDelivery(before));
    expect(draft).toEqual(draftBefore);
  });

  it('publish-pipeline.IT12 — the live version is ALREADY_CURRENT; an unknown one is NOT_FOUND', async () => {
    await threeVersions();
    await expect(service.activate(scope, 3, {})).rejects.toMatchObject({ code: 'ALREADY_CURRENT' });
    await expect(service.activate(scope, 99, {})).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('activation that loses the pointer race is PUBLISH_CONFLICT', async () => {
    await threeVersions();
    pointers.loseNextSwitch = true;
    await expect(service.activate(scope, 1, {})).rejects.toMatchObject({ code: 'PUBLISH_CONFLICT' });
    expect((await pointers.read('p1'))?.pointer?.version).toBe(3);
  });

  it('publish-pipeline.API06 — NOTHING_PUBLISHED before a publish; afterwards a retry re-emits', async () => {
    await expect(service.revalidate(scope, {})).rejects.toMatchObject({ code: 'NOTHING_PUBLISHED' });
    revalidation = 'failed';
    await publish();
    revalidation = 'ok';
    expect(await service.revalidate(scope, {})).toBe('ok');
    expect(events).toHaveLength(2);
  });

  it('ISnapshotReader — the live snapshot for a slug; null when unknown or unpublished', async () => {
    expect(await service.getCurrentForSlug('ada')).toBeNull();
    expect(await service.getCurrentForSlug('nobody')).toBeNull();
    await publish();
    expect((await service.getCurrentForSlug('ada'))?.version).toBe(1);
  });
});
