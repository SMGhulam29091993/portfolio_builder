/**
 * `filler-text` (warning; `publish-pipeline` → Publish rules): `lorem ipsum`, or `TODO` / `TBD`
 * as a whole word, in any string (case-insensitive).
 */
import { stringsOf } from '../content-walker.js';
import type { IPublishRule } from '../publishing.interface.js';
import type { PublishedContent, PublishIssue } from '../publishing.types.js';

const FILLER = /lorem ipsum|\b(?:todo|tbd)\b/i;

export class FillerTextRule implements IPublishRule {
  readonly id = 'filler-text';
  readonly severity = 'warning' as const;

  check(content: PublishedContent): Promise<PublishIssue[]> {
    return Promise.resolve(
      stringsOf(content)
        .filter(({ value }) => FILLER.test(value))
        .map(({ path }) => ({ rule: this.id, severity: this.severity, path, message: 'Looks like filler text' })),
    );
  }
}
