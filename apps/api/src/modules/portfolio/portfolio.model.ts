/**
 * Mongoose schemas of `portfolios` and `sections` (`section-engine` plan → Data Model). Imported
 * by the module's repositories and nothing else.
 *
 * Indexes carry the rules:
 * - `portfolios.userId` unique — one portfolio per user (ADR-0010); a provisioning race inserts
 *   one and the loser reads it (`section-engine.AC15`);
 * - `portfolios.slug` unique — the free portfolio's path;
 * - `sections { portfolioId, type }` unique — one document per section type per portfolio
 *   (ADR-0005), and every section query is scoped by `portfolioId` (tenant isolation).
 */
import { Schema, type Connection, type Model, type Types } from 'mongoose';

export interface PortfolioDocument {
  userId: Types.ObjectId;
  slug: string;
  sectionOrder: string[];
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SectionDocument {
  portfolioId: Types.ObjectId;
  type: string;
  visible: boolean;
  revision: number;
  data: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const portfolioSchema = new Schema<PortfolioDocument>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    sectionOrder: { type: [String], required: true, default: [] },
    revision: { type: Number, required: true, min: 1, default: 1 },
  },
  { collection: 'portfolios', timestamps: true, strict: 'throw' },
);

const sectionSchema = new Schema<SectionDocument>(
  {
    portfolioId: { type: Schema.Types.ObjectId, required: true },
    type: { type: String, required: true },
    visible: { type: Boolean, required: true },
    revision: { type: Number, required: true, min: 1, default: 1 },
    // The type's schema validated it before it got here; Mongo stores it as given.
    data: { type: Schema.Types.Mixed, required: true },
  },
  // `minimize: false` keeps empty objects and arrays inside `data` as written.
  { collection: 'sections', timestamps: true, strict: 'throw', minimize: false },
);

sectionSchema.index({ portfolioId: 1, type: 1 }, { unique: true });

const PORTFOLIO_MODEL = 'Portfolio';
const SECTION_MODEL = 'Section';

export function portfolioModel(connection: Connection): Model<PortfolioDocument> {
  return (
    (connection.models[PORTFOLIO_MODEL] as Model<PortfolioDocument> | undefined) ??
    connection.model<PortfolioDocument>(PORTFOLIO_MODEL, portfolioSchema)
  );
}

export function sectionModel(connection: Connection): Model<SectionDocument> {
  return (
    (connection.models[SECTION_MODEL] as Model<SectionDocument> | undefined) ??
    connection.model<SectionDocument>(SECTION_MODEL, sectionSchema)
  );
}
