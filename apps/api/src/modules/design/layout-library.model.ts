/**
 * Mongoose schemas of `design_layouts` and `design_presets` (`design-library` plan → Data
 * Model). Both are written by `design` only. Layouts and preset designs were validated
 * (`validateCustomLayout`, `IDesignValidator`) before they got here. Imported by the library
 * repositories only.
 */
import { Schema, type Connection, type Model, type Types } from 'mongoose';

export interface LayoutDocument {
  portfolioId: Types.ObjectId;
  section: string;
  name: string;
  layout: unknown;
  source: 'ai' | 'preset';
  createdAt: Date;
}

export interface PresetDocument {
  portfolioId: Types.ObjectId;
  name: string;
  theme: unknown;
  layout: Record<string, string>;
  createdAt: Date;
}

const layoutSchema = new Schema<LayoutDocument>(
  {
    portfolioId: { type: Schema.Types.ObjectId, required: true },
    section: { type: String, required: true },
    name: { type: String, required: true },
    layout: { type: Schema.Types.Mixed, required: true },
    source: { type: String, enum: ['ai', 'preset'], required: true },
    createdAt: { type: Date, required: true },
  },
  { collection: 'design_layouts', strict: 'throw', minimize: false },
);
layoutSchema.index({ portfolioId: 1, createdAt: -1 });

const presetSchema = new Schema<PresetDocument>(
  {
    portfolioId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    theme: { type: Schema.Types.Mixed, required: true },
    layout: { type: Schema.Types.Mixed, required: true },
    createdAt: { type: Date, required: true },
  },
  { collection: 'design_presets', strict: 'throw', minimize: false },
);
presetSchema.index({ portfolioId: 1, createdAt: -1 });

export function layoutModel(connection: Connection): Model<LayoutDocument> {
  return (connection.models.DesignLayout as Model<LayoutDocument> | undefined) ?? connection.model<LayoutDocument>('DesignLayout', layoutSchema);
}

export function presetModel(connection: Connection): Model<PresetDocument> {
  return (connection.models.DesignPreset as Model<PresetDocument> | undefined) ?? connection.model<PresetDocument>('DesignPreset', presetSchema);
}
