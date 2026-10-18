/**
 * Playwright configuration for `apps/web` end-to-end specs (`e2e/`, `constitution.md` →
 * Testing Discipline).
 *
 * Two servers back every run: the built API in front of a throwaway MongoDB
 * (`e2e/start-api.ts`), and `next dev` pointed at it through `API_INTERNAL_URL`. Ports are fixed
 * so the rewrite target is known before Next.js starts; they sit apart from the `pnpm dev`
 * defaults so a run does not collide with a developer's API. `next dev` still shares `.next/`
 * with a running web dev server, so stop `pnpm dev` before running `pnpm test:e2e`.
 */
import { defineConfig } from '@playwright/test';

/** API port used only by E2E runs. */
const E2E_API_PORT = 4100;

/** Web port used only by E2E runs. */
const E2E_WEB_PORT = 3100;

const apiOrigin = `http://127.0.0.1:${String(E2E_API_PORT)}`;
const webOrigin = `http://127.0.0.1:${String(E2E_WEB_PORT)}`;

/** How long each server may take to become ready, covering a cold `mongod` start. */
const SERVER_START_TIMEOUT_MS = 120_000;

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: true,
  reporter: 'list',
  use: { baseURL: webOrigin },
  webServer: [
    {
      command: `node e2e/start-api.ts ${String(E2E_API_PORT)} ${webOrigin}`,
      url: `${apiOrigin}/api/v1/health`,
      reuseExistingServer: false,
      timeout: SERVER_START_TIMEOUT_MS,
      // Lets the harness stop the API and MongoDB cleanly instead of being SIGKILLed.
      gracefulShutdown: { signal: 'SIGTERM', timeout: 15_000 },
    },
    {
      command: `next dev --hostname 127.0.0.1 --port ${String(E2E_WEB_PORT)}`,
      url: webOrigin,
      reuseExistingServer: false,
      timeout: SERVER_START_TIMEOUT_MS,
      env: { API_INTERNAL_URL: apiOrigin },
    },
  ],
});
