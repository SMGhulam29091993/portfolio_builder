/** `hasPlaceholder` — `publish-pipeline.UT02` patterns. */
import { describe, expect, it } from 'vitest';

import { hasPlaceholder } from './placeholder.js';

describe('hasPlaceholder', () => {
  it.each([
    ['My own app. [ADD A ONE-LINE DESCRIPTION OF WHAT SECOND BRAIN DOES]', true],
    ['[ADD LINK]', true],
    ['[Your headline]', true],
    ['[Your tool]', true],
    ['[Your name].config.ts', true],
    ['[1]', false],
    ['[beta]', false],
    ['Version [v2] notes', false],
    ['Your plan [draft]', false],
  ])('%j → %s', (text, expected) => {
    expect(hasPlaceholder(text)).toBe(expected);
  });
});
