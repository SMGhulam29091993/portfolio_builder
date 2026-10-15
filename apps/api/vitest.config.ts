/**
 * Vitest configuration for `apps/api`.
 *
 * Specs are colocated with the code under test (`constitution.md` → Testing Discipline).
 * The coverage floor and the shared Mongo test harness are added by `monorepo-foundation.T09`.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    // Integration specs start a real `mongod` and real child processes.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
