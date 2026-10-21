/**
 * `design-valid` (error; `publish-pipeline` → Publish rules): the design passes the design
 * validator (shape, catalogue, contrast) and every visible section has a layout. The verdict
 * comes from `design` through `IPublishDesignCheck` (ADR-0013).
 */
import type { IPublishDesignCheck, IPublishRule } from '../publishing.interface.js';
import type { PublishedContent, PublishIssue } from '../publishing.types.js';

export class DesignValidRule implements IPublishRule {
  readonly id = 'design-valid';
  readonly severity = 'error' as const;

  constructor(private readonly design: IPublishDesignCheck) {}

  check(content: PublishedContent): Promise<PublishIssue[]> {
    const visible = content.sections.map((section) => section.type);
    return Promise.resolve(
      this.design.check(content.design, visible).map(({ path, message }) => ({
        rule: this.id,
        severity: this.severity,
        path: path ? `design.${path}` : 'design',
        message,
      })),
    );
  }
}
