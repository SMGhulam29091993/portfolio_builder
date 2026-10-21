/** `designResolver` mirrors `validateDesign` (`design-theme.AC10`, `AC11`). */
import { DEFAULT_DESIGN, type DesignSpec } from '@portfolio/design-tokens';
import { describe, expect, it } from 'vitest';

import { designResolver } from './design-resolver';

const run = (values: DesignSpec) => Promise.resolve(designResolver(values, undefined, { fields: {}, shouldUseNativeValidation: false }));

describe('designResolver', () => {
  it('accepts the default design', async () => {
    await expect(run(structuredClone(DEFAULT_DESIGN))).resolves.toMatchObject({ errors: {} });
  });

  it('nests each issue at its path, contrast included', async () => {
    const design = structuredClone(DEFAULT_DESIGN);
    design.theme.colors.text = design.theme.colors.background;
    design.layout.hero = 'nope';

    const { errors } = await run(design);

    expect(errors).toMatchObject({
      theme: { colors: { text: { message: expect.stringContaining('at least 4.5:1') as string } } },
      layout: { hero: { message: 'Not a layout of this section' } },
    });
  });
});
