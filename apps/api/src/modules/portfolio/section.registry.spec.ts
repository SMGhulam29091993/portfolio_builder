/**
 * `SectionRegistry` (`section-engine.UT09`, `UT10`; AC10, AC11) and `CryptoIdGenerator`.
 */
import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { FakeHeroDefinition, FakeSectionDefinition } from '../../testing/index.js';
import { CryptoIdGenerator } from './adapters/crypto-id-generator.js';
import type { ISectionDefinition } from './portfolio.interface.js';
import { SectionRegistry, SectionRegistryError } from './section.registry.js';

describe('SectionRegistry', () => {
  it('section-engine.UT09 / AC10 — lists registered definitions in order and finds each', () => {
    const hero = new FakeHeroDefinition();
    const extra = new FakeSectionDefinition('extra');
    const registry = new SectionRegistry([hero, extra]);

    expect(registry.list()).toEqual([hero, extra]);
    expect(registry.get('extra')).toBe(extra);
    expect(registry.get('missing')).toBeUndefined();
  });

  it('section-engine.UT10 / AC11 — refuses a duplicate type, naming it', () => {
    expect(() => new SectionRegistry([new FakeSectionDefinition('dup'), new FakeSectionDefinition('dup')])).toThrow(
      /"dup": is registered twice/,
    );
  });

  it('refuses defaults that fail the definition schema, and a malformed type id', () => {
    const broken: ISectionDefinition = {
      type: 'broken',
      label: 'Broken',
      orderable: true,
      hideable: true,
      inNav: false,
      schema: z.object({ title: z.string().min(5) }),
      defaults: () => ({ title: 'x' }),
    };

    expect(() => new SectionRegistry([broken])).toThrow(SectionRegistryError);
    expect(() => new SectionRegistry([new FakeSectionDefinition('Bad Type')])).toThrow(/not a valid type id/);
  });
});

describe('CryptoIdGenerator', () => {
  it('produces 12 URL-safe characters, distinct each time', () => {
    const ids = new CryptoIdGenerator();
    const generated = new Set(Array.from({ length: 1_000 }, () => ids.next()));

    expect(generated.size).toBe(1_000);
    for (const id of generated) expect(id).toMatch(/^[\w-]{12}$/);
  });
});
