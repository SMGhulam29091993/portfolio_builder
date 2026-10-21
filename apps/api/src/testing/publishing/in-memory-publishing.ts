/**
 * In-memory fakes of the `publishing` ports for service, step and listener tests. They follow
 * the real adapters' contracts (`snapshot.repository.spec.ts`, `published-pointer.store.spec.ts`).
 */
import { ConflictError } from '../../core/errors/index.js';
import type {
  IPublishedPointerReader,
  IPublishedPointerWriter,
  ISnapshotRepository,
  NewSnapshot,
  PointerState,
  PublishedPointer,
  RevalidationStatus,
  SnapshotHeader,
  StoredSnapshot,
} from '../../modules/publishing/index.js';

export class InMemorySnapshotRepository implements ISnapshotRepository {
  private readonly rows: StoredSnapshot[] = [];
  private nextId = 1;
  /** Set to make the next `insert` fail with a taken version this many times (AC16). */
  versionTakenTimes = 0;
  /** Set to make `pruneOutsideWindow` reject (AC20). */
  failPrune = false;

  insert(snapshot: NewSnapshot): Promise<StoredSnapshot> {
    if (this.versionTakenTimes > 0 || this.rows.some((row) => row.portfolioId === snapshot.portfolioId && row.version === snapshot.version)) {
      this.versionTakenTimes = Math.max(0, this.versionTakenTimes - 1);
      return Promise.reject(new ConflictError('SNAPSHOT_VERSION_TAKEN', { version: snapshot.version }));
    }
    const stored: StoredSnapshot = {
      ...structuredClone(snapshot),
      id: `snap-${String(this.nextId++)}`,
      delivery: { status: 'pending', at: null, attempts: 0 },
    };
    this.rows.push(stored);
    return Promise.resolve(structuredClone(stored));
  }

  latestVersion(portfolioId: string): Promise<number> {
    return Promise.resolve(Math.max(0, ...this.of(portfolioId).map((row) => row.version)));
  }

  findById(portfolioId: string, snapshotId: string): Promise<StoredSnapshot | null> {
    return Promise.resolve(clone(this.of(portfolioId).find((row) => row.id === snapshotId)));
  }

  findByVersion(portfolioId: string, version: number): Promise<StoredSnapshot | null> {
    return Promise.resolve(clone(this.of(portfolioId).find((row) => row.version === version)));
  }

  list(portfolioId: string, limit: number, beforeVersion?: number): Promise<SnapshotHeader[]> {
    return Promise.resolve(
      this.of(portfolioId)
        .filter((row) => beforeVersion === undefined || row.version < beforeVersion)
        .toSorted((a, b) => b.version - a.version)
        .slice(0, limit)
        .map((row): SnapshotHeader => ({
          id: row.id,
          portfolioId: row.portfolioId,
          version: row.version,
          contentHash: row.contentHash,
          note: row.note,
          publishedAt: new Date(row.publishedAt),
          publishedBy: row.publishedBy,
          delivery: { ...row.delivery },
        })),
    );
  }

  updateDelivery(portfolioId: string, snapshotId: string, outcome: { status: RevalidationStatus; at: Date }): Promise<boolean> {
    const index = this.rows.findIndex((row) => row.portfolioId === portfolioId && row.id === snapshotId);
    const row = this.rows[index];
    if (!row) return Promise.resolve(false);
    this.rows[index] = { ...row, delivery: { ...outcome, attempts: row.delivery.attempts + 1 } };
    return Promise.resolve(true);
  }

  referencesAsset(portfolioId: string, assetId: string): Promise<boolean> {
    return Promise.resolve(this.of(portfolioId).some((row) => row.content.assets.some((asset) => asset.id === assetId)));
  }

  pruneOutsideWindow(portfolioId: string, keep: number, liveSnapshotId: string): Promise<number> {
    if (this.failPrune) return Promise.reject(new Error('prune failed'));
    const oldestKept = this.of(portfolioId).map((row) => row.version).sort((a, b) => b - a)[keep - 1];
    if (oldestKept === undefined) return Promise.resolve(0);
    const doomed = this.rows.filter((row) => row.portfolioId === portfolioId && row.version < oldestKept && row.id !== liveSnapshotId);
    for (const row of doomed) this.rows.splice(this.rows.indexOf(row), 1);
    return Promise.resolve(doomed.length);
  }

  /** Every stored row of a portfolio, for assertions. */
  all(portfolioId: string): StoredSnapshot[] {
    return structuredClone(this.of(portfolioId));
  }

  private of(portfolioId: string): StoredSnapshot[] {
    return this.rows.filter((row) => row.portfolioId === portfolioId);
  }
}

export class InMemoryPointerStore implements IPublishedPointerReader, IPublishedPointerWriter {
  private readonly states = new Map<string, PointerState>();
  /** Set to make the next `switchTo` reject this many times (AC15). */
  failSwitchTimes = 0;
  /** Set to make the next `switchTo` lose the compare-and-swap, as if another writer won. */
  loseNextSwitch = false;

  /** Registers a portfolio with no pointer. */
  add(portfolioId: string, slug: string): void {
    this.states.set(portfolioId, { portfolioId, slug, pointer: null });
  }

  switchTo(portfolioId: string, expectedSnapshotId: string | null, next: PublishedPointer): Promise<boolean> {
    if (this.failSwitchTimes > 0) {
      this.failSwitchTimes -= 1;
      return Promise.reject(new Error('pointer write failed'));
    }
    if (this.loseNextSwitch) {
      this.loseNextSwitch = false;
      return Promise.resolve(false);
    }
    const state = this.states.get(portfolioId);
    if (!state || (state.pointer?.snapshotId ?? null) !== expectedSnapshotId) return Promise.resolve(false);
    this.states.set(portfolioId, { ...state, pointer: { ...next } });
    return Promise.resolve(true);
  }

  read(portfolioId: string): Promise<PointerState | null> {
    return Promise.resolve(clone(this.states.get(portfolioId)));
  }

  listPublished(): Promise<PointerState[]> {
    return Promise.resolve([...this.states.values()].filter((state) => state.pointer !== null).map((state) => structuredClone(state)));
  }

  findBySlug(slug: string): Promise<PointerState | null> {
    return Promise.resolve(clone([...this.states.values()].find((state) => state.slug === slug)));
  }
}

function clone<T>(value: T | undefined): T | null {
  return value === undefined ? null : structuredClone(value);
}
