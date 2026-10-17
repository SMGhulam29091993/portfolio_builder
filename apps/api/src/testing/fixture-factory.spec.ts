import { describe, expect, it } from 'vitest';

import { FixtureFactory } from './fixture-factory.js';

interface Widget {
  readonly slug: string;
  readonly title: string;
  readonly tags: string[];
}

/** Minimal concrete factory, standing in for a module's real one. */
class WidgetFactory extends FixtureFactory<Widget> {
  protected defaults(sequence: number): Widget {
    return { slug: `widget-${String(sequence)}`, title: `Widget ${String(sequence)}`, tags: [] };
  }
}

describe('FixtureFactory', () => {
  it('monorepo-foundation.UT13 — numbers builds deterministically and applies overrides', () => {
    const factory = new WidgetFactory();

    expect(factory.build()).toEqual({ slug: 'widget-1', title: 'Widget 1', tags: [] });
    expect(factory.build({ title: 'Custom' })).toEqual({
      slug: 'widget-2',
      title: 'Custom',
      tags: [],
    });
  });

  it('monorepo-foundation.UT13 — buildList gives each fixture its own number and fresh objects', () => {
    const factory = new WidgetFactory();

    const [first, second] = factory.buildList(2, { title: 'Same' });

    expect(first?.slug).toBe('widget-1');
    expect(second?.slug).toBe('widget-2');
    expect(second?.title).toBe('Same');
    first?.tags.push('mutated');
    expect(second?.tags).toEqual([]);
  });

  it('restarts numbering after resetSequence()', () => {
    const factory = new WidgetFactory();
    factory.buildList(3);

    factory.resetSequence();

    expect(factory.build().slug).toBe('widget-1');
  });
});
