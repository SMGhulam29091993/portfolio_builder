/**
 * The page order rule (`section-engine.AC13`, `AC14`), kept apart from React so it is plain,
 * testable data: `hero` first, then the visible sections in `sectionOrder`, then any visible
 * type the order does not list yet; hidden sections absent; non-hero sections numbered `01…`
 * consecutively in rendered order.
 */

/** The type that always comes first and is never numbered. */
export const HERO_TYPE = 'hero';

/** A section as the composer receives it — from the CMS draft or a published snapshot. */
export interface ComposableSection<Data = unknown> {
  readonly type: string;
  readonly visible: boolean;
  readonly data: Data;
}

/** One section placed on the page. */
export interface PlacedSection<Data = unknown> extends ComposableSection<Data> {
  /** `01`, `02`, …; empty for `hero`. */
  readonly number: string;
  /** 1-based among the numbered sections; 0 for `hero`. */
  readonly position: number;
}

export function composeSections<Data>(
  sections: readonly ComposableSection<Data>[],
  sectionOrder: readonly string[],
): PlacedSection<Data>[] {
  const visible = sections.filter((section) => section.visible);
  const byType = new Map(visible.map((section) => [section.type, section]));

  const ordered: ComposableSection<Data>[] = [];
  const hero = byType.get(HERO_TYPE);
  if (hero) ordered.push(hero);
  for (const type of sectionOrder) {
    const section = byType.get(type);
    if (section && type !== HERO_TYPE && !ordered.includes(section)) ordered.push(section);
  }
  // A visible type the order does not list yet (registered after the order was saved) still
  // renders, after the listed ones, so content is never silently dropped.
  for (const section of visible) {
    if (!ordered.includes(section)) ordered.push(section);
  }

  let position = 0;
  return ordered.map((section) => {
    if (section.type === HERO_TYPE) return { ...section, number: '', position: 0 };
    position += 1;
    return { ...section, number: String(position).padStart(2, '0'), position };
  });
}
