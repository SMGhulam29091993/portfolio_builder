/**
 * The `design-valid` publish rule's verdict (`publish-pipeline` → Publish rules). Implements
 * `IPublishDesignCheck` owned by `publishing` (ADR-0013): `validateDesign` — the same function
 * as `design-theme.API02` and the CMS — plus a layout for every visible section: a catalogue
 * variant, or a `custom:<id>` the draft resolved to a layout copy (`design-library.AC4`).
 */
import { isCatalogueVariant, isCustomLayoutRef, validateDesign } from '@portfolio/design-tokens';

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
      if (typeof variant === 'string' && isCustomLayoutRef(variant)) {
        if (customLayoutsOf(design)[type] === undefined) {
          issues.push({ path, message: 'This section uses a custom layout that is no longer in your library' });
        }
      } else if (typeof variant !== 'string' || !isCatalogueVariant(type, variant)) {
        issues.push({ path, message: 'This visible section has no layout' });
      }
    }
    return issues;
  }
}

/** The custom layouts the draft resolved (`DesignDraftContributor`), by section. */
function customLayoutsOf(design: unknown): Readonly<Record<string, unknown>> {
  if (typeof design !== 'object' || design === null || !('customLayouts' in design)) return {};
  const { customLayouts } = design;
  return typeof customLayouts === 'object' && customLayouts !== null ? (customLayouts as Record<string, unknown>) : {};
}

/** The layout of a design that failed validation, as far as it can be read. */
function layoutOf(design: unknown): Readonly<Record<string, unknown>> {
  if (typeof design !== 'object' || design === null || !('layout' in design)) return {};
  const { layout } = design;
  return typeof layout === 'object' && layout !== null ? (layout as Record<string, unknown>) : {};
}
