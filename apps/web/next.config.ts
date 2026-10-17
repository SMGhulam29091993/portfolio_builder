/**
 * Next.js configuration for `apps/web`.
 *
 * The environment is validated inside `rewrites()`, which `next dev`, `next build` and
 * `next start` all evaluate at startup, so each fails fast naming a missing or malformed
 * variable instead of proxying to an undefined host. Loading it at module scope would also make
 * `next typegen` (run by `typecheck`) demand a runtime URL it never uses.
 */
import type { NextConfig } from 'next';

import { createApiRewrites } from './src/lib/api-proxy';
import { loadEnv } from './src/lib/env';

const nextConfig: NextConfig = {
  // No framework fingerprint header, matching the API (`app.ts`).
  poweredByHeader: false,
  reactStrictMode: true,
  // Agent instructions live at the repository root (ADR-0002); stop `next dev` writing a second,
  // framework-managed `AGENTS.md` into this app.
  agentRules: false,
  // `/api/v1/**` → `apps/api` (`monorepo-foundation.AC12`).
  rewrites() {
    return Promise.resolve(createApiRewrites(loadEnv().API_INTERNAL_URL));
  },
};

export default nextConfig;
