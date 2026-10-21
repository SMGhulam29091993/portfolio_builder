/**
 * `validateDesign` — the one verdict on a candidate design (`design-theme.AC3`, `AC4`, `AC11`):
 * the shape, then every font in its allow-listed role, every section's variant in its catalogue
 * or a well-formed `custom:<id>` reference (`design-library`),
 * and every contrast pair. All problems come back together with their paths. The API's
 * `DesignValidator` and the CMS both call it, so their answers cannot differ.
 */
import { isCatalogueVariant, SECTION_TYPES } from './catalogue.js';
import { checkContrast } from './contrast.js';
import { FONT_ROLES, fontRole } from './fonts.js';
import { isCustomLayoutRef } from './layout.js';
import { designSpecSchema, type DesignSpec } from './schema.js';

export interface DesignIssue {
  readonly path: string;
  readonly message: string;
}

export type DesignVerdict =
  | { readonly ok: true; readonly design: DesignSpec }
  | { readonly ok: false; readonly issues: readonly DesignIssue[] };

export function validateDesign(input: unknown): DesignVerdict {
  const parsed = designSpecSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.map(String).join('.'), message: issue.message })),
    };
  }
  const design = parsed.data;
  const issues: DesignIssue[] = [];

  for (const role of FONT_ROLES) {
    const fontId = design.theme.fonts[role];
    const actual = fontRole(fontId);
    if (actual === undefined) issues.push({ path: `theme.fonts.${role}`, message: 'Not an available font' });
    else if (actual !== role) issues.push({ path: `theme.fonts.${role}`, message: `This font is a ${actual} font` });
  }
  for (const section of SECTION_TYPES) {
    const variant = design.layout[section];
    // A `custom:<id>` entry names a library layout (`design-library`, ADR-0014); whether it exists
    // for this section is the API's check, since the library lives in the database.
    if (!isCatalogueVariant(section, variant) && !isCustomLayoutRef(variant)) {
      issues.push({ path: `layout.${section}`, message: 'Not a layout of this section' });
    }
  }
  for (const result of checkContrast(design.theme.colors)) {
    if (!result.passes) {
      issues.push({
        path: `theme.colors.${result.foreground}`,
        message: `Contrast with ${result.background} is ${result.ratio.toFixed(2)}:1; at least ${String(result.minimum)}:1 is required`,
      });
    }
  }
  return issues.length > 0 ? { ok: false, issues } : { ok: true, design };
}
