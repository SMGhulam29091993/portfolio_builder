// @ts-check
/**
 * ESLint flat config for `apps/api`: the shared baseline plus the `portfolio` boundary rules that
 * make `constitution.md` → Architectural Constraints mechanical (`monorepo-foundation.AC9`).
 *
 * Exemptions are file globs here rather than special cases inside the rules, so every exception
 * to a boundary is visible in one place. The globs start with `**` so the lint fixtures in
 * `apps/api/test-fixtures/`, which mirror `src/`, are treated exactly like real source.
 */
import { defineConfig } from 'eslint/config';

import { createBaseConfig } from './base.js';
import boundaries from './plugin/index.js';

/** Where the composition root lives; it alone wires concrete classes. */
const COMPOSITION_ROOT = ['**/src/container.ts'];

/** The only reader of `process.env`. */
const ENV_READER = ['**/src/config/env.ts'];

/** Tests and their shared harness construct classes under test directly. */
const TEST_FILES = ['**/*.spec.ts', '**/src/testing/**/*.ts'];

/**
 * @param {{ tsconfigRootDir: string }} options
 *   `tsconfigRootDir` — the API workspace directory (pass `import.meta.dirname`).
 */
export function createApiConfig({ tsconfigRootDir }) {
  return defineConfig(
    createBaseConfig({ tsconfigRootDir }),
    {
      // TypeScript only: the instantiation rule needs the type information enabled for it there.
      files: ['**/*.{ts,mts,cts}'],
      plugins: { portfolio: boundaries },
      rules: {
        'portfolio/module-boundary': 'error',
        'portfolio/no-process-env': 'error',
        'portfolio/no-instantiation-outside-container': 'error',
      },
    },
    {
      files: ['**/*.service.ts'],
      rules: { 'portfolio/no-framework-in-service': 'error' },
    },
    {
      files: COMPOSITION_ROOT,
      rules: {
        'portfolio/module-boundary': 'off',
        'portfolio/no-instantiation-outside-container': 'off',
      },
    },
    {
      files: ENV_READER,
      rules: { 'portfolio/no-process-env': 'off' },
    },
    {
      files: TEST_FILES,
      rules: { 'portfolio/no-instantiation-outside-container': 'off' },
    },
  );
}
