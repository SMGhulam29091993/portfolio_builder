/**
 * Vitest configuration for `apps/api`.
 *
 * Specs are colocated with the code under test (`constitution.md` → Testing Discipline); shared
 * test support (Mongo harness, fixture factories, fakes) lives in `src/testing/`.
 *
 * Coverage floor (ADR-0007): 80% lines and branches on each module service. It is enforced by
 * `pnpm test` (`vitest run --coverage`), so CI fails below it; a plain `vitest run <file>` while
 * developing skips coverage and so never fails on it. Files matching `include` count even when no
 * test imports them, so a service shipped without tests fails the floor instead of hiding.
 */
import { defineConfig } from 'vitest/config';

/** Minimum percentage the constitution claims for module services. No other path has a floor. */
const SERVICE_COVERAGE_FLOOR = 80;

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    // Integration specs start a real `mongod` and real child processes.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/modules/**/*.service.ts'],
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds: {
        // Per file, so one well-tested service cannot carry an untested one over the floor.
        perFile: true,
        lines: SERVICE_COVERAGE_FLOOR,
        branches: SERVICE_COVERAGE_FLOOR,
      },
    },
  },
});
