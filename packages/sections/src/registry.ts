/**
 * `SectionRendererRegistry` — which component renders a section type in a layout variant
 * (`section-engine.T07`; `int-standards.nextjs.md` → Adding a section type or layout variant;
 * ADR-0006 → Variant catalogue). Strategy + Registry on the web side: a section spec adds a
 * renderer by registering it, and the page composer is never edited.
 *
 * Every type registers a `default` variant — the reference design's layout — and may register
 * alternates (`design-theme`). A lookup for an unknown variant falls back to `default`, so a
 * stored design naming a variant this build no longer has still renders.
 */
import type { ComponentType } from 'react';

/** The id of the reference layout every type has. */
export const DEFAULT_VARIANT = 'default';

/**
 * What every renderer receives (`int-standards.nextjs.md` → Components: pure, props in).
 *
 * @typeParam Data - The section's payload type from `packages/contracts`.
 * @typeParam Context - Page-wide data the composer passes through unchanged (identity, …).
 */
export interface SectionRendererProps<Data = unknown, Context = unknown> {
  readonly data: Data;
  /** `01`, `02`, … — derived from visible order, never stored; empty for `hero`. */
  readonly number: string;
  /** 1-based position among the numbered sections; 0 for `hero`. */
  readonly position: number;
  readonly context: Context;
}

// The registry stores renderers whose data types differ; each is registered with its own
// precise type and looked up by type id, so the stored form erases `Data`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySectionRenderer<Context = unknown> = ComponentType<SectionRendererProps<any, Context>>;

/** A registry entry: one type, one variant, one component. */
export interface SectionRendererEntry<Context = unknown> {
  readonly type: string;
  readonly variant: string;
  readonly component: AnySectionRenderer<Context>;
  /** Shown in the CMS variant picker. */
  readonly label: string;
}

export class SectionRendererRegistry<Context = unknown> {
  private readonly entries = new Map<string, SectionRendererEntry<Context>>();

  /**
   * @throws {Error} A type/variant pair registered twice — a wiring bug, caught at module load.
   */
  constructor(entries: readonly SectionRendererEntry<Context>[]) {
    for (const entry of entries) {
      const key = keyOf(entry.type, entry.variant);
      if (this.entries.has(key)) {
        throw new Error(`Renderer for section "${entry.type}" variant "${entry.variant}" is registered twice`);
      }
      this.entries.set(key, entry);
    }
  }

  /** The renderer for `type` in `variant`, falling back to `default`; `undefined` if neither. */
  get(type: string, variant: string = DEFAULT_VARIANT): AnySectionRenderer<Context> | undefined {
    return (this.entries.get(keyOf(type, variant)) ?? this.entries.get(keyOf(type, DEFAULT_VARIANT)))
      ?.component;
  }

  /** The variants registered for `type`, `default` first. */
  variantsOf(type: string): readonly { readonly variant: string; readonly label: string }[] {
    return [...this.entries.values()]
      .filter((entry) => entry.type === type)
      .sort((a, b) => Number(b.variant === DEFAULT_VARIANT) - Number(a.variant === DEFAULT_VARIANT))
      .map(({ variant, label }) => ({ variant, label }));
  }
}

function keyOf(type: string, variant: string): string {
  return `${type}\u0000${variant}`;
}
