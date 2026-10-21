// @ts-check
/**
 * ESLint configuration for `packages/sections`: the base rules plus `portfolio/no-style-literals`
 * on renderers (`design-theme.AC8`). Specs are exempt — a test may assert on a literal.
 */
import { defineConfig } from 'eslint/config';

import { createBaseConfig } from './base.js';
import boundaries from './plugin/index.js';

/** @param {{ tsconfigRootDir: string }} options */
export function createSectionsConfig({ tsconfigRootDir }) {
  return defineConfig(
    createBaseConfig({ tsconfigRootDir }),
    {
      files: ['**/*.{ts,tsx}'],
      ignores: ['**/*.spec.{ts,tsx}'],
      plugins: { portfolio: boundaries },
      rules: { 'portfolio/no-style-literals': 'error' },
    },
  );
}
