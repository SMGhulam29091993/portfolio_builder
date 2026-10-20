/**
 * `links-valid` (error; `publish-pipeline` → Publish rules): every stored link — a string under
 * a `url`, `link` or `href` key — parses and is `https:` or `mailto:` (`constitution.md` → URLs).
 * Links were validated on save; this is the second check at publish.
 */
import { walkContent } from '../content-walker.js';
import type { IPublishRule } from '../publishing.interface.js';
import type { PublishedContent, PublishIssue } from '../publishing.types.js';

const LINK_KEYS: ReadonlySet<string | number> = new Set(['url', 'link', 'href']);
const ALLOWED_PROTOCOLS: ReadonlySet<string> = new Set(['https:', 'mailto:']);

export class LinksValidRule implements IPublishRule {
  readonly id = 'links-valid';
  readonly severity = 'error' as const;

  check(content: PublishedContent): Promise<PublishIssue[]> {
    const issues: PublishIssue[] = [];
    walkContent(content, ({ value, path, key }) => {
      if (!LINK_KEYS.has(key) || typeof value !== 'string') return;
      if (!URL.canParse(value) || !ALLOWED_PROTOCOLS.has(new URL(value).protocol)) {
        issues.push({ rule: this.id, severity: this.severity, path, message: 'Links must be valid and start with https: or mailto:' });
      }
    });
    return Promise.resolve(issues);
  }
}
