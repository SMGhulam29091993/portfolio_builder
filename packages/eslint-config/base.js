// @ts-check
/**
 * Baseline ESLint flat config shared by every workspace.
 *
 * Holds only the rules every workspace agrees on. The API's architecture rules — module import
 * boundaries, framework imports in services, `process.env` access, instantiation outside
 * `container.ts` — live in `api.js` (`monorepo-foundation.AC9`), which extends this baseline.
 */
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Generated or vendored output that is never linted. */
const IGNORED_PATHS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/.next-e2e/**',
  '**/.turbo/**',
  '**/coverage/**',
  '**/next-env.d.ts',
];

/**
 * Builds the baseline config for one workspace.
 *
 * @param {{ tsconfigRootDir: string }} options
 *   `tsconfigRootDir` — the consuming workspace's directory (pass `import.meta.dirname`), so
 *   type-aware rules resolve that workspace's own `tsconfig.json`.
 */
export function createBaseConfig({ tsconfigRootDir }) {
  return defineConfig(
    globalIgnores(IGNORED_PATHS),
    {
      linterOptions: { reportUnusedDisableDirectives: 'error' },
    },
    js.configs.recommended,
    {
      // TypeScript sources get the strict, type-aware rule sets.
      files: ['**/*.{ts,tsx,mts,cts}'],
      extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
      languageOptions: {
        parserOptions: { projectService: true, tsconfigRootDir },
      },
      rules: {
        '@typescript-eslint/consistent-type-imports': 'error',
        '@typescript-eslint/no-explicit-any': 'error',
      },
    },
    {
      // Plain JavaScript (config files, scripts) runs on Node.
      files: ['**/*.{js,mjs,cjs}'],
      languageOptions: { globals: globals.node },
    },
  );
}
