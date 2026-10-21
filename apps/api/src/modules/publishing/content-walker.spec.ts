/**
 * The content walker the rules share (`publish-pipeline` → Edge Cases: every string is walked).
 */
import { describe, expect, it } from 'vitest';

import { cleanContent, seedContent } from '../../testing/index.js';
import { assetReferencesOf, stringsOf } from './content-walker.js';

describe('content walker', () => {
  it('addresses sections by type and arrays by index', () => {
    const paths = stringsOf(seedContent()).map((entry) => entry.path);
    expect(paths).toContain('sections.work.projects[3].description');
    expect(paths).toContain('identity.seo.title');
    expect(paths.some((path) => path.startsWith('sections.hero.'))).toBe(true);
  });

  it('finds asset ids with the kind their field needs, skipping empty ones and the asset list', () => {
    const content = cleanContent();
    content.identity.resume.assetId = 'r1';
    content.identity.seo.ogImageAssetId = 'i1';
    (content.sections[0]?.data as Record<string, unknown>).coverAssetId = 'x1';
    content.assets = [{ id: 'r1', kind: 'resume', filename: 'a', mime: 'b', sizeBytes: 1, sha256: 'c' }];
    expect(assetReferencesOf(content)).toEqual([
      { path: 'identity.resume.assetId', assetId: 'r1', expectedKind: 'resume' },
      { path: 'identity.seo.ogImageAssetId', assetId: 'i1', expectedKind: 'image' },
      { path: 'sections.hero.coverAssetId', assetId: 'x1', expectedKind: null },
    ]);
    content.identity.resume.assetId = null;
    expect(assetReferencesOf(content).map((reference) => reference.assetId)).not.toContain(null);
  });
});
