/**
 * `SectionRendererRegistry` — which component renders a section type in a layout variant
 * (`section-engine.T07`; `int-standards.nextjs.md` → Adding a section type or layout variant;
 * ADR-0006 → Variant catalogue). Strategy + Registry on the web side: a section spec adds a
 * renderer by registering it, and the page composer is never edited.
 *
 * Each type registers its reference variant first, then its alternates (`design-theme` → Variant
 * catalogue). A lookup for an unknown variant falls back to the first one registered, so a
 * stored design naming a variant this build no longer has still renders.
 */
import type { ComponentType } from 'react';

/**
 * Kept for callers that name no variant: a lookup with it, or with any unknown id, falls back
 * to the type's first registered variant — its reference layout (`design-theme` → Variant
 * catalogue: the first variant is the fallback).
 */
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
  /** The first variant registered per type: its reference layout and fallback. */
  private readonly fallbacks = new Map<string, SectionRendererEntry<Context>>();

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
      if (!this.fallbacks.has(entry.type)) this.fallbacks.set(entry.type, entry);
    }
  }

  /** The renderer for `type` in `variant`, falling back to its first variant; `undefined` if none. */
  get(type: string, variant: string = DEFAULT_VARIANT): AnySectionRenderer<Context> | undefined {
    return (this.entries.get(keyOf(type, variant)) ?? this.fallbacks.get(type))?.component;
  }

  /** The variants registered for `type`, in registration order (the reference first). */
  variantsOf(type: string): readonly { readonly variant: string; readonly label: string }[] {
    return [...this.entries.values()]
      .filter((entry) => entry.type === type)
      .map(({ variant, label }) => ({ variant, label }));
  }
}

function keyOf(type: string, variant: string): string {
  return `${type}\u0000${variant}`;
}
