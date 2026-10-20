/** `createEditorRegistry` — `cms-panel-shell.UT04` (AC4). */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createEditorRegistry } from './editor-registry';

const Editor = () => null;

describe('editor registry (cms-panel-shell.UT04)', () => {
  it('finds a registered editor and nothing for an unregistered type', () => {
    const registry = createEditorRegistry([{ type: 'about', schema: z.object({}), Editor }]);

    expect(registry.get('about')?.Editor).toBe(Editor);
    expect(registry.get('blog')).toBeUndefined();
  });

  it('refuses a duplicate type', () => {
    expect(() =>
      createEditorRegistry([
        { type: 'about', schema: z.object({}), Editor },
        { type: 'about', schema: z.object({}), Editor },
      ]),
    ).toThrow(/registered twice/);
  });
});
