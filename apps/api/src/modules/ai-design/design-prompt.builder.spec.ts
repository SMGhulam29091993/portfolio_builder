/**
 * `DesignPromptBuilder` (`ai-design-studio.T03`; UT14; AC3, AC4, AC15): what a provider is sent.
 */
import { CONTRAST_PAIRS, DEFAULT_DESIGN, FONT_ALLOW_LIST, SECTION_TYPES, VARIANT_CATALOGUE } from '@portfolio/design-tokens';
import { describe, expect, it } from 'vitest';

import { DesignPromptBuilder } from './design-prompt.builder.js';
import type { PromptInput } from './ai-design.types.js';

const builder = new DesignPromptBuilder({ variants: VARIANT_CATALOGUE, fonts: FONT_ALLOW_LIST, contrastPairs: CONTRAST_PAIRS });

const input: PromptInput = {
  prompt: 'Calm and editorial, with a warm accent',
  scope: 'both',
  current: DEFAULT_DESIGN,
  visibleSections: ['hero', 'about', 'work'],
  explore: false,
};

/** Everything that would cross the wire, as one string. */
const sent = (request: ReturnType<typeof builder.build>) => JSON.stringify(request);

describe('DesignPromptBuilder', () => {
  it('ai-design-studio.UT14 / AC15 — sends the catalogue, fonts, rules, scope, sections and current design', () => {
    const request = builder.build(input);
    for (const variant of Object.values(VARIANT_CATALOGUE).flat()) expect(request.instructions).toContain(variant.id);
    for (const font of FONT_ALLOW_LIST) expect(request.instructions).toContain(font.id);
    expect(request.instructions).toContain('textMuted on background: at least 4.5:1');
    expect(request.instructions).toMatch(/never write HTML, CSS, JavaScript, URLs/);
    expect(request.messages).toHaveLength(1);
    const [message] = request.messages;
    expect(message?.role).toBe('user');
    expect(message?.content).toContain(input.prompt);
    expect(message?.content).toContain('hero, about, work');
    expect(message?.content).toContain(JSON.stringify(DEFAULT_DESIGN));
  });

  it('ai-design-studio.UT14 / AC15 — carries nothing beyond its input: no name, email or section text can appear', () => {
    // The input type has no field for them; prove the request is a function of the input alone.
    const request = builder.build(input);
    expect(Object.keys(request).sort()).toEqual(['instructions', 'messages', 'schema', 'schemaName']);
    const owner = { name: 'Ada Lovelace', email: 'ada@example.test', bio: 'Builds analytical engines.' };
    const text = sent(request);
    for (const value of Object.values(owner)) expect(text).not.toContain(value);
    // Two builds from equal input are equal: nothing else leaks in.
    expect(builder.build({ ...input })).toEqual(request);
  });

  it('starts fresh when basedOnCurrent is false, and states each scope', () => {
    const fresh = builder.build({ ...input, current: null }).messages[0]?.content ?? '';
    expect(fresh).toContain('Start fresh');
    expect(fresh).not.toContain(JSON.stringify(DEFAULT_DESIGN));
    expect(builder.build({ ...input, scope: 'theme' }).messages[0]?.content).toContain('Change only the theme');
    expect(builder.build({ ...input, scope: 'layout' }).messages[0]?.content).toContain('Change only the layout');
  });

  it('sends a closed JSON Schema derived from DesignSpec, narrowed to the catalogue', () => {
    const { schema, schemaName } = builder.build(input);
    expect(schemaName).toBe('design_proposal');
    expect(schema).not.toHaveProperty('$schema');
    expect(schema).toMatchObject({
      type: 'object',
      additionalProperties: false,
      required: expect.arrayContaining(['theme', 'layout', 'rationale']) as unknown,
    });
    const properties = schema.properties as Record<string, { properties: Record<string, unknown> }>;
    expect(properties.layout?.properties.hero).toMatchObject({ enum: ['split-code-card', 'centered'] });
    const fonts = (properties.theme?.properties.fonts ?? {}) as { properties: Record<string, unknown> };
    expect(fonts.properties.mono).toMatchObject({ enum: ['jetbrains-mono', 'ibm-plex-mono', 'fira-code'] });
    expect(properties.rationale).toMatchObject({ type: 'string', maxLength: 400 });
    // Every object in it is closed, as strict structured-output modes require.
    const open: string[] = [];
    const walk = (node: unknown, path: string) => {
      if (typeof node !== 'object' || node === null) return;
      const record = node as Record<string, unknown>;
      if (record.type === 'object' && record.additionalProperties !== false) open.push(path);
      for (const [key, child] of Object.entries(record)) walk(child, `${path}.${key}`);
    };
    walk(schema, '');
    expect(open).toEqual([]);
  });

  it('ai-design-studio.AC3 / AC4 — the repair turn echoes the answer and lists every issue', () => {
    const request = builder.build(input);
    const repaired = builder.repair(request, '{"theme": "dark"}', [
      { path: 'theme', message: 'Expected object' },
      { path: 'theme.colors.text', message: 'Contrast with background is 2.10:1; at least 4.5:1 is required' },
    ]);
    expect(repaired.instructions).toBe(request.instructions);
    expect(repaired.schema).toBe(request.schema);
    expect(repaired.messages).toHaveLength(3);
    expect(repaired.messages[1]).toEqual({ role: 'assistant', content: '{"theme": "dark"}' });
    expect(repaired.messages[2]?.content).toContain('- theme: Expected object');
    expect(repaired.messages[2]?.content).toContain('2.10:1');
    // The original request is not mutated.
    expect(request.messages).toHaveLength(1);
    // A huge answer is cut in the echo.
    expect(builder.repair(request, 'x'.repeat(10_000), []).messages[1]?.content).toHaveLength(4_000);
  });
});

describe('custom layouts in the request (design-library.AC7)', () => {
  it('lists every section\'s blocks with their style options in the instructions', () => {
    const { instructions } = builder.build(input);
    expect(instructions).toContain('Custom layouts');
    expect(instructions).toContain('- work: featured, projects [grid | list]');
    expect(instructions).toContain('Every block of the section must appear exactly once');
  });

  it('asks for new layouts only when exploring and the layout may change', () => {
    const explore = (scope: PromptInput['scope']) => builder.build({ ...input, scope, explore: true }).messages[0]?.content ?? '';
    expect(explore('both')).toContain('Explore: design a NEW custom layout');
    expect(explore('layout')).toContain('Explore: design a NEW custom layout');
    expect(explore('theme')).not.toContain('Explore:');
    expect(builder.build(input).messages[0]?.content).not.toContain('Explore:');
  });

  it('the schema carries custom layouts only when exploring a layout, with a tree per visible section', () => {
    const customOf = (request: ReturnType<typeof builder.build>) =>
      (request.schema.properties as Record<string, { properties?: Record<string, unknown> }>).customLayouts;
    expect(customOf(builder.build(input))).toBeUndefined();
    expect(customOf(builder.build({ ...input, scope: 'theme', explore: true }))).toBeUndefined();
    const explored = customOf(builder.build({ ...input, explore: true }));
    expect(Object.keys(explored?.properties ?? {})).toEqual(['hero', 'about', 'work']);
    // An unknown section type is ignored rather than given a tree.
    const unknown = customOf(builder.build({ ...input, explore: true, visibleSections: ['work', 'blog'] }));
    expect(Object.keys(unknown?.properties ?? {})).toEqual(['work']);
  });

  it('each tree is nullable, fixed-depth and holds only that section\'s block names', () => {
    const { schema } = builder.build({ ...input, explore: true });
    const properties = schema.properties as Record<string, { properties?: Record<string, unknown> }>;
    const text = JSON.stringify(properties.customLayouts?.properties?.work);
    expect(text).toContain('"featured"');
    expect(text).toContain('"projects"');
    expect(text).not.toContain('"bio"');
    expect(text).toContain('"null"');
    // No recursion: nothing refers back to itself.
    expect(JSON.stringify(schema)).not.toContain('"$ref"');
  });

  it('equal requests share one schema object; the repair keeps it', () => {
    const first = builder.build({ ...input, explore: true });
    expect(builder.build({ ...input, explore: true, prompt: 'Something else' }).schema).toBe(first.schema);
    expect(builder.repair(first, '{}', []).schema).toBe(first.schema);
  });
});

/** The size of a schema as structured-output limits count it: its bytes and its `anyOf` branches. */
function schemaCost(node: unknown): { bytes: number; branches: number } {
  let branches = 0;
  const walk = (value: unknown) => {
    if (typeof value !== 'object' || value === null) return;
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.anyOf)) branches += record.anyOf.length;
    for (const child of Object.values(record)) walk(child);
  };
  walk(node);
  return { bytes: JSON.stringify(node).length, branches };
}

/**
 * What Gemini's structured output was seen to accept on 2026-10-21: the base schema plus one
 * section's custom layout tree. The schema with all six trees (11 169 bytes, 64 branches) was
 * refused with HTTP 400, and the recorded provider answers the other tests use never send a
 * schema to a real provider, so nothing else would notice the schema growing past this again.
 */
const GEMINI_ACCEPTED = { bytes: 4_000, branches: 12 } as const;

describe('the answer schema stays within what Gemini accepts', () => {
  it.each(['theme', 'layout', 'both'] as const)('a %s request without explore sends no custom layouts', (scope) => {
    const cost = schemaCost(builder.build({ ...input, scope, visibleSections: [...SECTION_TYPES] }).schema);
    expect(cost.bytes).toBeLessThanOrEqual(GEMINI_ACCEPTED.bytes);
    expect(cost.branches).toBe(0);
  });

  it.each([...SECTION_TYPES])('exploring the %s section alone stays within it', (section) => {
    const cost = schemaCost(builder.build({ ...input, explore: true, visibleSections: [section] }).schema);
    expect(cost.bytes).toBeLessThanOrEqual(GEMINI_ACCEPTED.bytes);
    expect(cost.branches).toBeLessThanOrEqual(GEMINI_ACCEPTED.branches);
  });
});
