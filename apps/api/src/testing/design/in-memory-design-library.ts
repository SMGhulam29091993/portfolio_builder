/**
 * In-memory fakes of the design library repositories (`design-library.T03`). They pass the same
 * contract suite as the MongoDB repositories (`design-library-repositories.contract.spec.ts`).
 */
import { Types } from 'mongoose';

import type {
  DesignSpec,
  ILayoutLibraryRepository,
  IPresetRepository,
  NewLayout,
  StoredLayout,
  StoredPreset,
} from '../../modules/design/index.js';

export class InMemoryLayoutLibrary implements ILayoutLibraryRepository {
  private rows: StoredLayout[] = [];

  findLayout(portfolioId: string, layoutId: string): Promise<StoredLayout | null> {
    return Promise.resolve(structuredClone(this.rows.find((row) => row.portfolioId === portfolioId && row.id === layoutId) ?? null));
  }

  insertMany(portfolioId: string, layouts: readonly NewLayout[], createdAt: Date): Promise<StoredLayout[]> {
    const created = layouts.map((layout) => ({
      id: new Types.ObjectId().toString(),
      portfolioId,
      section: layout.layout.section,
      name: layout.name,
      layout: structuredClone(layout.layout),
      source: layout.source,
      createdAt,
    }));
    this.rows.push(...created);
    return Promise.resolve(structuredClone(created));
  }

  list(portfolioId: string): Promise<StoredLayout[]> {
    return Promise.resolve(structuredClone(newestFirst(this.rows.filter((row) => row.portfolioId === portfolioId))));
  }

  count(portfolioId: string): Promise<number> {
    return Promise.resolve(this.rows.filter((row) => row.portfolioId === portfolioId).length);
  }

  delete(portfolioId: string, layoutId: string): Promise<boolean> {
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => !(row.portfolioId === portfolioId && row.id === layoutId));
    return Promise.resolve(this.rows.length < before);
  }
}

export class InMemoryPresetRepository implements IPresetRepository {
  private rows: StoredPreset[] = [];

  insert(portfolioId: string, preset: { name: string; design: DesignSpec }, createdAt: Date): Promise<StoredPreset> {
    const created = { id: new Types.ObjectId().toString(), portfolioId, name: preset.name, design: structuredClone(preset.design), createdAt };
    this.rows.push(created);
    return Promise.resolve(structuredClone(created));
  }

  find(portfolioId: string, presetId: string): Promise<StoredPreset | null> {
    return Promise.resolve(structuredClone(this.rows.find((row) => row.portfolioId === portfolioId && row.id === presetId) ?? null));
  }

  list(portfolioId: string): Promise<StoredPreset[]> {
    return Promise.resolve(structuredClone(newestFirst(this.rows.filter((row) => row.portfolioId === portfolioId))));
  }

  count(portfolioId: string): Promise<number> {
    return Promise.resolve(this.rows.filter((row) => row.portfolioId === portfolioId).length);
  }

  delete(portfolioId: string, presetId: string): Promise<boolean> {
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => !(row.portfolioId === portfolioId && row.id === presetId));
    return Promise.resolve(this.rows.length < before);
  }

  usesLayout(portfolioId: string, layoutRef: string): Promise<boolean> {
    return Promise.resolve(
      this.rows.some((row) => row.portfolioId === portfolioId && Object.values(row.design.layout as Record<string, string>).includes(layoutRef)),
    );
  }
}

/** Newest first, ties by id, as the repositories sort. */
function newestFirst<T extends { id: string; createdAt: Date }>(rows: T[]): T[] {
  return rows.toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1));
}
