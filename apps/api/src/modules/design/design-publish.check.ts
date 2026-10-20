/**
 * The `design-valid` publish rule's verdict (`publish-pipeline` → Publish rules). Implements
 * `IPublishDesignCheck` owned by `publishing` (ADR-0013): `validateDesign` — the same function
 * as `design-theme.API02` and the CMS — plus a catalogue variant for every visible section.
 */
import { isCatalogueVariant, validateDesign } from '@portfolio/design-tokens';

import type { DesignCheckIssue, IPublishDesignCheck } from '../publishing/index.js';

export class DesignPublishCheck implements IPublishDesignCheck {
  check(design: unknown, visibleSectionTypes: readonly string[]): DesignCheckIssue[] {
    const verdict = validateDesign(design);
    const issues: DesignCheckIssue[] = verdict.ok ? [] : verdict.issues.map(({ path, message }) => ({ path, message }));
    const layout: Readonly<Record<string, unknown>> = verdict.ok ? verdict.design.layout : layoutOf(design);
    for (const type of visibleSectionTypes) {
      const path = `layout.${type}`;
      if (issues.some((issue) => issue.path === path)) continue;
      const variant = layout[type];
      if (typeof variant !== 'string' || !isCatalogueVariant(type, variant)) {
        issues.push({ path, message: 'This visible section has no layout' });
      }
    }
    return issues;
  }
}

/** The layout of a design that failed validation, as far as it can be read. */
function layoutOf(design: unknown): Readonly<Record<string, unknown>> {
  if (typeof design !== 'object' || design === null || !('layout' in design)) return {};
  const { layout } = design;
  return typeof layout === 'object' && layout !== null ? (layout as Record<string, unknown>) : {};
}
