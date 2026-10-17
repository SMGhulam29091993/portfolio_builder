// Baseline rules plus the architecture boundary rules (`monorepo-foundation.AC9`).
import { createApiConfig } from '@portfolio/eslint-config/api';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig(
  createApiConfig({ tsconfigRootDir: import.meta.dirname }),
  // Deliberate violations, linted only by `src/architecture/boundary-lint.spec.ts`.
  globalIgnores(['test-fixtures/**']),
);
