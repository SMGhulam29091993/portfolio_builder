/**
 * `ISnapshotBuilder` (`publish-pipeline.T03`; AC9) — Builder: turns the draft's parts into the
 * content a snapshot stores. Only visible sections, in render order (`hero` first, then
 * `sectionOrder`); `assets` lists exactly the existing assets the content refers to, sorted by id.
 * A reference to a missing asset is left out here and reported by `assets-resolve`.
 */
import { assetReferencesOf } from './content-walker.js';
import type { IPublishedAssetSource, ISnapshotBuilder } from './publishing.interface.js';
import { SNAPSHOT_SCHEMA_VERSION, type DraftParts, type PublishedAsset, type PublishedContent } from './publishing.types.js';

export class SnapshotBuilder implements ISnapshotBuilder {
  constructor(private readonly assets: IPublishedAssetSource) {}

  async build(portfolioId: string, parts: DraftParts): Promise<PublishedContent> {
    const rank = (type: string) => {
      const index = parts.sections.order.indexOf(type);
      return index === -1 ? Number.MAX_SAFE_INTEGER : index;
    };
    const sections = parts.sections.sections
      .filter((section) => section.visible)
      .toSorted((a, b) => rank(a.type) - rank(b.type))
      .map(({ type, data }) => ({ type, data }));
    const content: PublishedContent = {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      identity: parts.identity,
      sections,
      design: {
        theme: parts.design.theme,
        layout: { ...parts.design.layout },
        // A copy, so a later library change never alters what this snapshot shows (AC4).
        ...(parts.design.customLayouts && Object.keys(parts.design.customLayouts).length > 0
          ? { customLayouts: structuredClone(parts.design.customLayouts) }
          : {}),
      },
      assets: [],
    };
    const ids = [...new Set(assetReferencesOf(content).map((reference) => reference.assetId))].sort();
    const found = await Promise.all(ids.map((id) => this.assets.findById(portfolioId, id)));
    const assets: PublishedAsset[] = found
      .filter((asset) => asset !== null)
      .map(({ id, kind, filename, mime, sizeBytes, sha256 }) => ({ id, kind, filename, mime, sizeBytes, sha256 }));
    return { ...content, assets };
  }
}
