/**
 * `assets-resolve` (error; `publish-pipeline` → Publish rules, IT08): every referenced asset
 * exists — the builder lists only existing ones in `assets` — and has the kind its field needs.
 */
import { assetReferencesOf } from '../content-walker.js';
import type { IPublishRule } from '../publishing.interface.js';
import type { PublishedContent, PublishIssue } from '../publishing.types.js';

const KIND_NAMES = { resume: 'a résumé', image: 'an image' } as const;

export class AssetsResolveRule implements IPublishRule {
  readonly id = 'assets-resolve';
  readonly severity = 'error' as const;

  check(content: PublishedContent): Promise<PublishIssue[]> {
    const issues: PublishIssue[] = [];
    for (const { path, assetId, expectedKind } of assetReferencesOf(content)) {
      const asset = content.assets.find((candidate) => candidate.id === assetId);
      if (!asset) {
        issues.push({ rule: this.id, severity: this.severity, path, message: 'This file no longer exists' });
      } else if (expectedKind !== null && asset.kind !== expectedKind) {
        issues.push({ rule: this.id, severity: this.severity, path, message: `This file must be ${KIND_NAMES[expectedKind]}` });
      }
    }
    return Promise.resolve(issues);
  }
}
