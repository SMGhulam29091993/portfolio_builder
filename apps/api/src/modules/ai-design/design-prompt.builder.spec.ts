/**
 * `DesignPromptBuilder` (`ai-design-studio.T03`; UT14; AC3, AC4, AC15): what a provider is sent.
 */
import { CONTRAST_PAIRS, DEFAULT_DESIGN, FONT_ALLOW_LIST, VARIANT_CATALOGUE } from '@portfolio/design-tokens';
import { describe, expect, it } from 'vitest';

import { DesignPromptBuilder } from './design-prompt.builder.js';
import type { PromptInput } from './ai-design.types.js';

const builder = new DesignPromptBuilder({ variants: VARIANT_CATALOGUE, fonts: FONT_ALLOW_LIST, contrastPairs: CONTRAST_PAIRS });

const input: PromptInput = {
  prompt: 'Calm and editorial, with a warm accent',
  scope: 'both',
  current: DEFAULT_DESIGN,
  visibleSections: ['hero', 'about', 'work'],
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
