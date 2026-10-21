// Lints this package with its own baseline, which also proves the config loads.
import { defineConfig } from 'eslint/config';

import { createBaseConfig } from './base.js';

export default defineConfig(
  // The plugin's type declaration is type-checked where it is consumed (`packages/sections`);
  // this package has no tsconfig to lint a `.d.ts` with.
  { ignores: ['plugin/index.d.ts'] },
  createBaseConfig({ tsconfigRootDir: import.meta.dirname }),
);
