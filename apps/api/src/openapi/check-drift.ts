/**
 * `pnpm drift` — fails when `openapi/openapi.yaml` and the mounted routes differ
 * (`monorepo-foundation.AC10`). Run by CI alongside build, typecheck, lint and test.
 *
 * Builds the real container and app to read the route table, but never connects to MongoDB or
 * Redis: the configuration below is a fixed, unreachable placeholder that only satisfies
 * validation.
 */
import { readFileSync } from 'node:fs';

import { createApp } from '../app.js';
import { loadEnv } from '../config/env.js';
import { buildContainer } from '../container.js';
import { MongoConnection } from '../core/db/mongo-connection.js';
import { JsonLogger } from '../core/logger/json-logger.js';
import { findDrift, readDocumentedOperations } from './openapi-drift.js';

const OPENAPI_DOCUMENT = new URL('../../openapi/openapi.yaml', import.meta.url);

/** Static configuration for building the route table. No port is bound, no URL connected. */
const ROUTE_TABLE_ENV = {
  NODE_ENV: 'test',
  PORT: '1',
  MONGODB_URI: 'mongodb://127.0.0.1:1/openapi-drift-check',
  REDIS_URL: 'redis://127.0.0.1:1/0',
};

const logger = new JsonLogger(process.stdout);
const env = loadEnv(ROUTE_TABLE_ENV);
const mongo = MongoConnection.getInstance({
  uri: env.MONGODB_URI,
  serverSelectionTimeoutMs: 1,
  cacheAcrossReloads: false,
});

const { routes } = createApp(buildContainer({ env, logger, mongo }));
const issues = findDrift(routes, readDocumentedOperations(readFileSync(OPENAPI_DOCUMENT, 'utf8')));

if (issues.length > 0) {
  logger.error('openapi drift detected', { issues: issues.map((issue) => issue.message) });
  process.exitCode = 1;
} else {
  logger.info('openapi document matches the mounted routes', { routes: routes.length });
}
