/**
 * Walks published content node by node with issue paths (`publish-pipeline` → Publish rules).
 * Rules walk every value instead of a list of fields (spec → Edge Cases), so a new field in any
 * payload is checked without a rule changing. A section is addressed by its type, not its index:
 * `sections.work.projects[3].description`.
 *
 * Pure functions with no state or I/O.
 */
import type { AssetKind } from '@portfolio/contracts';

import type { PublishedContent } from './publishing.types.js';

/** One node: its value, its issue path and the key or index it sits under in its parent. */
export interface ContentNode {
  readonly value: unknown;
  readonly path: string;
  readonly key: string | number;
}

/** Calls `visit` for every node below the root, depth first, parents before children. */
export function walkContent(content: PublishedContent, visit: (node: ContentNode) => void): void {
  for (const [key, value] of Object.entries(content)) {
    if (key === 'sections' && Array.isArray(value)) {
      visit({ value, path: 'sections', key });
      for (const section of content.sections) {
        walkValue(section.data, `sections.${section.type}`, section.type, visit);
      }
      continue;
    }
    walkValue(value, key, key, visit);
  }
}

function walkValue(value: unknown, path: string, key: string | number, visit: (node: ContentNode) => void): void {
  visit({ value, path, key });
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walkValue(item, `${path}[${String(index)}]`, index, visit);
    });
  } else if (typeof value === 'object' && value !== null) {
    for (const [childKey, child] of Object.entries(value)) walkValue(child, `${path}.${childKey}`, childKey, visit);
  }
}

/** Every string in the content, with its path. */
export function stringsOf(content: PublishedContent): { path: string; value: string }[] {
  const found: { path: string; value: string }[] = [];
  walkContent(content, ({ value, path }) => {
    if (typeof value === 'string') found.push({ path, value });
  });
  return found;
}

/** One asset id the content refers to, and the kind the field requires (when it requires one). */
export interface AssetReference {
  readonly path: string;
  readonly assetId: string;
  readonly expectedKind: AssetKind | null;
}

/**
 * Every asset id in the content: any non-empty string under a key ending in `assetId`
 * (`resume.assetId`, `seo.ogImageAssetId`). A field under `resume` needs a résumé; a key naming
 * an image needs an image. The `assets` list itself is not a reference.
 */
export function assetReferencesOf(content: PublishedContent): AssetReference[] {
  const found: AssetReference[] = [];
  walkContent(content, ({ value, path, key }) => {
    if (path.startsWith('assets') || typeof key !== 'string' || !/assetid$/i.test(key)) return;
    if (typeof value !== 'string' || value.length === 0) return;
    const expectedKind: AssetKind | null = /(^|\.)resume\./i.test(path) ? 'resume' : /image/i.test(key) ? 'image' : null;
    found.push({ path, assetId: value, expectedKind });
  });
  return found;
}
