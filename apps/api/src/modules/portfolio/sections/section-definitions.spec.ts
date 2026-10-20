/**
 * The six section definitions: `section-engine.CT01` over every registered definition, then each
 * section's AC1 (the reference seed validates) and AC2 (the invalid payloads its spec lists, each
 * reported at its path).
 */
import { describe, expect, it } from 'vitest';
import type { ZodType } from 'zod';

import { REFERENCE_ABOUT } from '../../../seed/data/sections/about.js';
import { REFERENCE_CONTACT } from '../../../seed/data/sections/contact.js';
import { REFERENCE_EXPERIENCE } from '../../../seed/data/sections/experience.js';
import { REFERENCE_HERO } from '../../../seed/data/sections/hero.js';
import { REFERENCE_STACK } from '../../../seed/data/sections/stack.js';
import { REFERENCE_WORK } from '../../../seed/data/sections/work.js';
import { SectionRegistry } from '../section.registry.js';
import { AboutSectionDefinition } from './about.definition.js';
import { ContactSectionDefinition } from './contact.definition.js';
import { ExperienceSectionDefinition } from './experience.definition.js';
import { HeroSectionDefinition } from './hero.definition.js';
import { StackSectionDefinition } from './stack.definition.js';
import { WorkSectionDefinition } from './work.definition.js';

const definitions = [
  new HeroSectionDefinition(),
  new AboutSectionDefinition(),
  new WorkSectionDefinition(),
  new ExperienceSectionDefinition(),
  new StackSectionDefinition(),
  new ContactSectionDefinition(),
];

/** The sorted failing paths of `data` against `schema`. */
function failingPaths(schema: ZodType, data: unknown): string[] {
  const result = schema.safeParse(data);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.')).sort();
}

const clone = <T>(value: T): T => structuredClone(value);

describe('section-engine.CT01 — every definition', () => {
  it.each(definitions)('$type: defaults satisfy the schema, flags are booleans, placeholders are bracketed', (definition) => {
    expect(definition.schema.safeParse(definition.defaults()).success).toBe(true);
    for (const flag of [definition.orderable, definition.hideable, definition.inNav]) expect(typeof flag).toBe('boolean');
    expect(JSON.stringify(definition.defaults())).toMatch(/\[[^\]]+\]/);
  });

  it('registers all six without conflict; only hero is fixed', () => {
    const registry = new SectionRegistry(definitions);
    expect(registry.list().filter((d) => !d.orderable).map((d) => d.type)).toEqual(['hero']);
  });
});

describe('AC1 — every reference seed validates', () => {
  it.each([
    ['hero', REFERENCE_HERO],
    ['about', REFERENCE_ABOUT],
    ['work', REFERENCE_WORK],
    ['experience', REFERENCE_EXPERIENCE],
    ['stack', REFERENCE_STACK],
    ['contact', REFERENCE_CONTACT],
  ])('%s', (type, data) => {
    const definition = definitions.find((d) => d.type === type);
    expect(failingPaths(definition?.schema as ZodType, data)).toEqual([]);
  });
});

describe('hero-section.AC2', () => {
  it('reports each invalid case at its path', () => {
    const hero = clone(REFERENCE_HERO);
    hero.codeCard.entries[0] = { ...hero.codeCard.entries[0], key: '1bad' } as never;
    hero.codeCard.entries[2] = { ...hero.codeCard.entries[2], key: 'experience' } as never;
    hero.marquee.items = ['a', 'b', 'a', 'c'];
    hero.primaryCta = { label: 'Top', target: { kind: 'section', sectionType: 'hero' } };

    expect(failingPaths(new HeroSectionDefinition().schema, hero)).toEqual([
      'codeCard.entries.0.key',
      'codeCard.entries.2.key',
      'marquee.items.2',
      'primaryCta.target.sectionType',
    ]);
  });

  it('caps entries, list values and marquee length', () => {
    const hero = clone(REFERENCE_HERO);
    hero.codeCard.entries = Array.from({ length: 9 }, (_, i) => ({ id: `e${String(i)}`, key: `k${String(i)}`, value: 'v' }));
    hero.marquee.items = ['a', 'b', 'c'];
    expect(failingPaths(new HeroSectionDefinition().schema, hero)).toEqual(['codeCard.entries', 'marquee.items']);
    const list = clone(REFERENCE_HERO);
    list.codeCard.entries[3] = { id: 'x', key: 'stack', value: Array.from({ length: 9 }, (_, i) => `t${String(i)}`) };
    expect(failingPaths(new HeroSectionDefinition().schema, list)).toEqual(['codeCard.entries.3.value']);
  });
});

describe('about-section.AC2', () => {
  it('fifth stat, long bio, one step while enabled', () => {
    const about = clone(REFERENCE_ABOUT);
    about.stats.push({ id: 's5', value: '1', label: 'x' });
    about.bio = 'b'.repeat(601);
    about.process.steps = about.process.steps.slice(0, 1);
    expect(failingPaths(new AboutSectionDefinition().schema, about)).toEqual(['bio', 'process.steps', 'stats']);
  });

  it('allows one step when the process card is hidden, refuses five', () => {
    const hidden = clone(REFERENCE_ABOUT);
    hidden.process = { ...hidden.process, enabled: false, steps: hidden.process.steps.slice(0, 1) };
    expect(failingPaths(new AboutSectionDefinition().schema, hidden)).toEqual([]);
    const five = clone(REFERENCE_ABOUT);
    five.process.steps.push({ id: 'x', title: 't', description: 'd' });
    expect(failingPaths(new AboutSectionDefinition().schema, five)).toEqual(['process.steps']);
  });
});

describe('work-showcase.AC2', () => {
  it('two featured, three metrics on a regular card, http link, duplicate tags', () => {
    const work = clone(REFERENCE_WORK);
    work.projects[1] = { ...work.projects[1], featured: true } as never;
    (work.projects[2]?.metrics as { id: string; value: string; label: string }[]).push({ id: 'm3', value: '1', label: 'x' });
    work.projects[3] = { ...work.projects[3], link: 'http://insecure.example', tags: ['Next.js', 'next.js'] } as never;
    expect(failingPaths(new WorkSectionDefinition().schema, work)).toEqual([
      'projects.1.featured',
      'projects.2.metrics',
      'projects.3.link',
      'projects.3.tags.1',
    ]);
  });

  it('no projects and ten projects', () => {
    const none = { ...clone(REFERENCE_WORK), projects: [] };
    expect(failingPaths(new WorkSectionDefinition().schema, none)).toEqual(['projects']);
    const ten = { ...clone(REFERENCE_WORK), projects: Array.from({ length: 10 }, (_, i) => ({ ...REFERENCE_WORK.projects[1], id: `p${String(i)}` })) };
    expect(failingPaths(new WorkSectionDefinition().schema, ten)).toEqual(['projects']);
  });
});

describe('experience-timeline.AC2', () => {
  it('end before start, month 13, no highlights, seven highlights', () => {
    const experience = clone(REFERENCE_EXPERIENCE);
    experience.entries[1] = { ...experience.entries[1], end: { year: 2023, month: 1 } } as never;
    experience.entries[0] = { ...experience.entries[0], start: { year: 2024, month: 13 }, highlights: [] } as never;
    expect(failingPaths(new ExperienceSectionDefinition().schema, experience)).toEqual([
      'entries.0.highlights',
      'entries.0.start.month',
      'entries.1.end',
    ]);
    const seven = clone(REFERENCE_EXPERIENCE);
    seven.entries[1] = { ...seven.entries[1], highlights: Array(7).fill('h') } as never;
    expect(failingPaths(new ExperienceSectionDefinition().schema, seven)).toEqual(['entries.1.highlights']);
  });
});

describe('stack-credentials.AC2', () => {
  it('empty group, duplicate items, end year before start, http certificate', () => {
    const stack = clone(REFERENCE_STACK);
    stack.groups[0] = { ...stack.groups[0], items: [] } as never;
    stack.groups[1] = { ...stack.groups[1], items: ['Node.js', 'node.js'] } as never;
    stack.education.entries[0] = { ...stack.education.entries[0], endYear: 2018 } as never;
    stack.certifications.entries[0] = { ...stack.certifications.entries[0], url: 'http://x.example' } as never;
    expect(failingPaths(new StackSectionDefinition().schema, stack)).toEqual([
      'certifications.entries.0.url',
      'education.entries.0.endYear',
      'groups.0.items',
      'groups.1.items.1',
    ]);
  });
});

describe('contact-section.AC2', () => {
  it('empty CTA label, long body, long subject', () => {
    const contact = { ...clone(REFERENCE_CONTACT), body: 'b'.repeat(201), emailCta: { label: '', subject: 's'.repeat(121) } };
    expect(failingPaths(new ContactSectionDefinition().schema, contact)).toEqual(['body', 'emailCta.label', 'emailCta.subject']);
  });
});
