/**
 * The layout variant catalogue (`design-theme` spec → Variant catalogue; ADR-0006). Two variants
 * per section; the first is the reference layout and the fallback for an id this build does not
 * know. A variant id is never deleted, only hidden, so stored designs and snapshots stay
 * renderable.
 */
export const SECTION_TYPES = ['hero', 'about', 'work', 'experience', 'stack', 'contact'] as const;
export type CatalogueSectionType = (typeof SECTION_TYPES)[number];

export interface VariantInfo {
  readonly id: string;
  readonly label: string;
}

export const VARIANT_CATALOGUE: Readonly<Record<CatalogueSectionType, readonly VariantInfo[]>> = Object.freeze({
  hero: [
    { id: 'split-code-card', label: 'Split with code card' },
    { id: 'centered', label: 'Centred' },
  ],
  about: [
    { id: 'bento', label: 'Bento grid' },
    { id: 'stacked', label: 'Stacked' },
  ],
  work: [
    { id: 'featured-grid', label: 'Featured + grid' },
    { id: 'list', label: 'List' },
  ],
  experience: [
    { id: 'timeline', label: 'Timeline' },
    { id: 'cards', label: 'Cards' },
  ],
  stack: [
    { id: 'chip-groups', label: 'Chip groups' },
    { id: 'columns', label: 'Columns' },
  ],
  contact: [
    { id: 'glow-card', label: 'Glow card' },
    { id: 'minimal', label: 'Minimal' },
  ],
});

/** `true` when `variant` belongs to `section`'s catalogue. */
export function isCatalogueVariant(section: string, variant: string): boolean {
  const entries = (VARIANT_CATALOGUE as Readonly<Record<string, readonly VariantInfo[] | undefined>>)[section];
  return entries?.some((entry) => entry.id === variant) ?? false;
}

/** The reference variant of `section`, or `undefined` for a type outside the catalogue. */
export function referenceVariant(section: string): string | undefined {
  return (VARIANT_CATALOGUE as Readonly<Record<string, readonly VariantInfo[] | undefined>>)[section]?.[0]?.id;
}
