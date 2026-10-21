/**
 * Custom layouts (`design-library` spec → Custom layout, the canonical owner; ADR-0014): one
 * section's existing building blocks arranged in stacks and columns, at most two levels deep.
 * Data only — the site draws it with reviewed components, never as model-written markup.
 *
 * The shape is checked here by zod; `validateCustomLayout` adds the rules zod cannot express
 * (blocks of the right section, styles, the `columns` pairing, every block exactly once) and
 * reports every problem with its path, like `validateDesign`.
 */
import { z } from 'zod';

import { SECTION_TYPES, type CatalogueSectionType } from './catalogue.js';

export const LAYOUT_GAPS = ['sm', 'md', 'lg'] as const;
export const LAYOUT_COLUMNS = ['1-1', '2-1', '1-2', '1-1-1'] as const;
export const LAYOUT_ALIGNS = ['start', 'center'] as const;
export type LayoutGap = (typeof LAYOUT_GAPS)[number];
export type LayoutColumns = (typeof LAYOUT_COLUMNS)[number];
export type LayoutAlign = (typeof LAYOUT_ALIGNS)[number];

/** How many children each `columns` value lays out side by side. */
export const COLUMN_COUNTS: Readonly<Record<LayoutColumns, number>> = { '1-1': 2, '2-1': 2, '1-2': 2, '1-1-1': 3 };

/**
 * The block catalogue: for each section, its blocks and their style options. Every block is an
 * existing component, and every style an option that component already has.
 */
export const LAYOUT_BLOCKS: Readonly<Record<CatalogueSectionType, Readonly<Record<string, readonly string[]>>>> = Object.freeze({
  hero: { intro: [], 'code-card': [] },
  about: { bio: [], currently: [], stats: ['two-columns', 'four-columns'], process: ['row', 'list'] },
  work: { featured: [], projects: ['grid', 'list'] },
  experience: { jobs: ['timeline', 'cards'] },
  stack: { skills: ['cards', 'rows'], credentials: [] },
  contact: { message: [], actions: [] },
});

/** Most children any container takes. */
export const MAX_LAYOUT_CHILDREN = 4;

export const layoutBlockSchema = z.object({
  kind: z.literal('block'),
  block: z.string().min(1).max(32),
  style: z.string().min(1).max(32).nullable(),
});

export const layoutInnerSchema = z.object({
  kind: z.enum(['stack', 'columns']),
  gap: z.enum(LAYOUT_GAPS),
  columns: z.enum(LAYOUT_COLUMNS).nullable(),
  children: z.array(layoutBlockSchema).min(1).max(MAX_LAYOUT_CHILDREN),
});

export const customLayoutSchema = z.object({
  section: z.enum(SECTION_TYPES),
  align: z.enum(LAYOUT_ALIGNS),
  body: z.object({
    kind: z.enum(['stack', 'columns']),
    gap: z.enum(LAYOUT_GAPS),
    columns: z.enum(LAYOUT_COLUMNS).nullable(),
    children: z.array(z.union([layoutInnerSchema, layoutBlockSchema])).min(1).max(MAX_LAYOUT_CHILDREN),
  }),
});

export type LayoutBlock = z.infer<typeof layoutBlockSchema>;
export type LayoutInner = z.infer<typeof layoutInnerSchema>;
export type CustomLayout = z.infer<typeof customLayoutSchema>;

/** A design's layout entry naming a library layout: `custom:<24-hex id>`. */
export const CUSTOM_LAYOUT_PREFIX = 'custom:';
const CUSTOM_REF = /^custom:[0-9a-f]{24}$/;

/** `true` for a well-formed `custom:<id>` layout entry. */
export function isCustomLayoutRef(value: string): boolean {
  return CUSTOM_REF.test(value);
}

/** The library id in a `custom:<id>` entry, or `undefined` for anything else. */
export function customLayoutId(value: string): string | undefined {
  return isCustomLayoutRef(value) ? value.slice(CUSTOM_LAYOUT_PREFIX.length) : undefined;
}

export interface LayoutIssue {
  readonly path: string;
  readonly message: string;
}

export type LayoutVerdict =
  | { readonly ok: true; readonly layout: CustomLayout }
  | { readonly ok: false; readonly issues: readonly LayoutIssue[] };

/**
 * The one verdict on a candidate custom layout (`design-library.AC1`).
 *
 * @param section - When given, the layout must be for this section.
 */
export function validateCustomLayout(input: unknown, section?: CatalogueSectionType): LayoutVerdict {
  const parsed = customLayoutSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.map(String).join('.'), message: issue.message })),
    };
  }
  const layout = parsed.data;
  const issues: LayoutIssue[] = [];
  if (section !== undefined && layout.section !== section) {
    issues.push({ path: 'section', message: `This layout is for ${layout.section}, not ${section}` });
  }

  const catalogue = LAYOUT_BLOCKS[layout.section];
  const seen = new Map<string, number>();

  const checkContainer = (container: { kind: 'stack' | 'columns'; columns: LayoutColumns | null; children: readonly unknown[] }, path: string) => {
    if (container.kind === 'columns') {
      if (container.columns === null) issues.push({ path: `${path}.columns`, message: 'Columns need a column split' });
      else if (container.children.length !== COLUMN_COUNTS[container.columns]) {
        issues.push({ path: `${path}.children`, message: `A ${container.columns} split takes ${String(COLUMN_COUNTS[container.columns])} children` });
      }
    } else if (container.columns !== null) {
      issues.push({ path: `${path}.columns`, message: 'A stack has no column split' });
    }
  };

  const checkBlock = (block: LayoutBlock, path: string) => {
    const styles = catalogue[block.block];
    if (styles === undefined) {
      issues.push({ path: `${path}.block`, message: `Not a block of the ${layout.section} section` });
      return;
    }
    seen.set(block.block, (seen.get(block.block) ?? 0) + 1);
    if (styles.length === 0 && block.style !== null) issues.push({ path: `${path}.style`, message: 'This block has no styles' });
    if (styles.length > 0 && (block.style === null || !styles.includes(block.style))) {
      issues.push({ path: `${path}.style`, message: `Choose one of: ${styles.join(', ')}` });
    }
  };

  checkContainer(layout.body, 'body');
  layout.body.children.forEach((child, index) => {
    const path = `body.children.${String(index)}`;
    if (child.kind === 'block') {
      checkBlock(child, path);
      return;
    }
    checkContainer(child, path);
    child.children.forEach((block, inner) => {
      checkBlock(block, `${path}.children.${String(inner)}`);
    });
  });

  // Every block exactly once, so no content is dropped or drawn twice.
  for (const block of Object.keys(catalogue)) {
    const count = seen.get(block) ?? 0;
    if (count === 0) issues.push({ path: 'body', message: `Missing the ${block} block` });
    if (count > 1) issues.push({ path: 'body', message: `The ${block} block appears ${String(count)} times` });
  }
  return issues.length > 0 ? { ok: false, issues } : { ok: true, layout };
}
