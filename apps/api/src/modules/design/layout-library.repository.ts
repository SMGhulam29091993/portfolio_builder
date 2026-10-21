/**
 * MongoDB access for the design library (`design-library.T03`): `design_layouts` and
 * `design_presets`, every query scoped by `portfolioId`.
 */
import { isValidObjectId } from 'mongoose';

import type { IMongoConnectionProvider } from '../../core/db/database-connection.interface.js';
import type { ILayoutLibraryRepository, IPresetRepository } from './design.interface.js';
import type { CustomLayout, DesignSpec, NewLayout, StoredLayout, StoredPreset } from './design.types.js';
import { layoutModel, presetModel, type LayoutDocument, type PresetDocument } from './layout-library.model.js';

type Lean<T> = T & { _id: { toString(): string } };

export class LayoutLibraryRepository implements ILayoutLibraryRepository {
  constructor(private readonly connections: IMongoConnectionProvider) {}

  async findLayout(portfolioId: string, layoutId: string): Promise<StoredLayout | null> {
    if (!isValidObjectId(portfolioId) || !isValidObjectId(layoutId)) return null;
    const found = await this.model().findOne({ _id: layoutId, portfolioId }).lean<Lean<LayoutDocument>>().exec();
    return found ? toLayout(found) : null;
  }

  async insertMany(portfolioId: string, layouts: readonly NewLayout[], createdAt: Date): Promise<StoredLayout[]> {
    if (layouts.length === 0) return [];
    const created = await this.model().insertMany(
      layouts.map((layout) => ({ portfolioId, section: layout.layout.section, name: layout.name, layout: layout.layout, source: layout.source, createdAt })),
    );
    return created.map((document) => toLayout(document.toObject() as Lean<LayoutDocument>));
  }

  async list(portfolioId: string): Promise<StoredLayout[]> {
    if (!isValidObjectId(portfolioId)) return [];
    const rows = await this.model().find({ portfolioId }).sort({ createdAt: -1, _id: -1 }).lean<Lean<LayoutDocument>[]>().exec();
    return rows.map(toLayout);
  }

  async count(portfolioId: string): Promise<number> {
    if (!isValidObjectId(portfolioId)) return 0;
    return this.model().countDocuments({ portfolioId }).exec();
  }

  async delete(portfolioId: string, layoutId: string): Promise<boolean> {
    if (!isValidObjectId(portfolioId) || !isValidObjectId(layoutId)) return false;
    return (await this.model().deleteOne({ _id: layoutId, portfolioId }).exec()).deletedCount === 1;
  }

  private model() {
    return layoutModel(this.connections.getConnection());
  }
}

export class PresetRepository implements IPresetRepository {
  constructor(private readonly connections: IMongoConnectionProvider) {}

  async insert(portfolioId: string, preset: { name: string; design: DesignSpec }, createdAt: Date): Promise<StoredPreset> {
    const created = await this.model().create({ portfolioId, name: preset.name, theme: preset.design.theme, layout: preset.design.layout, createdAt });
    return toPreset(created.toObject());
  }

  async find(portfolioId: string, presetId: string): Promise<StoredPreset | null> {
    if (!isValidObjectId(portfolioId) || !isValidObjectId(presetId)) return null;
    const found = await this.model().findOne({ _id: presetId, portfolioId }).lean<Lean<PresetDocument>>().exec();
    return found ? toPreset(found) : null;
  }

  async list(portfolioId: string): Promise<StoredPreset[]> {
    if (!isValidObjectId(portfolioId)) return [];
    const rows = await this.model().find({ portfolioId }).sort({ createdAt: -1, _id: -1 }).lean<Lean<PresetDocument>[]>().exec();
    return rows.map(toPreset);
  }

  async count(portfolioId: string): Promise<number> {
    if (!isValidObjectId(portfolioId)) return 0;
    return this.model().countDocuments({ portfolioId }).exec();
  }

  async delete(portfolioId: string, presetId: string): Promise<boolean> {
    if (!isValidObjectId(portfolioId) || !isValidObjectId(presetId)) return false;
    return (await this.model().deleteOne({ _id: presetId, portfolioId }).exec()).deletedCount === 1;
  }

  async usesLayout(portfolioId: string, layoutRef: string): Promise<boolean> {
    if (!isValidObjectId(portfolioId)) return false;
    const presets = await this.model().find({ portfolioId }, { layout: 1 }).lean<{ layout: Record<string, string> }[]>().exec();
    return presets.some((preset) => Object.values(preset.layout).includes(layoutRef));
  }

  private model() {
    return presetModel(this.connections.getConnection());
  }
}

function toLayout(document: Lean<LayoutDocument>): StoredLayout {
  const layout = document.layout as CustomLayout;
  return {
    id: document._id.toString(),
    portfolioId: document.portfolioId.toString(),
    section: layout.section,
    name: document.name,
    layout,
    source: document.source,
    createdAt: document.createdAt,
  };
}

function toPreset(document: Lean<PresetDocument>): StoredPreset {
  return {
    id: document._id.toString(),
    portfolioId: document.portfolioId.toString(),
    name: document.name,
    design: { theme: document.theme, layout: document.layout } as DesignSpec,
    createdAt: document.createdAt,
  };
}
