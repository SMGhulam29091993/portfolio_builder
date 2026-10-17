/**
 * Vitest configuration for `apps/web` unit tests.
 *
 * Specs are colocated with the code under test (`constitution.md` → Testing Discipline).
 * Playwright specs live in `e2e/` and run through `playwright.config.ts`, never here.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.{ts,tsx}'],
    environment: 'node',
  },
});
