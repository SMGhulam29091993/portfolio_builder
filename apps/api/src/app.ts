/**
 * Express app factory: global middleware, module routers under `/api/v1`, then the 404 and
 * error handlers. Order follows `architecture.md` → Request lifecycle:
 *
 *   helmet → request id → JSON body → [`/auth`, `/cms`: Origin allow-list]
 *   → [per-route: rate limiter → validate] → controller → notFound → error middleware
 *
 * Rate limiters are per mount, so they run inside each module's router, after the JSON body is
 * parsed; the 100 KiB body limit bounds the cost of parsing before a limiter can reject.
 *
 * Returns the mounted route table alongside the handler so the OpenAPI drift check can compare
 * it with `openapi/openapi.yaml` (`monorepo-foundation.AC10`).
 */
import express, { type Express } from 'express';

import type { Container } from './container.js';
import {
  createErrorHandler,
  createJsonBodyParser,
  createRequestId,
  createSecurityHeaders,
  notFound,
  type HttpMethod,
} from './core/http/index.js';

/** Version prefix every route is mounted under (`constitution.md` → Versioning Rules). */
export const API_PREFIX = '/api/v1';

/** One live route with its full path, as the drift check sees it. */
export interface MountedRoute {
  readonly method: HttpMethod;
  /** Full Express path, e.g. `/api/v1/health`. */
  readonly path: string;
}

export interface ApiApplication {
  /** The request handler to serve. */
  readonly handler: Express;
  /** Every route mounted on `handler`. */
  readonly routes: readonly MountedRoute[];
}

export function createApp(container: Container): ApiApplication {
  const app = express();
  // helmet removes the header too; disabling it at the source keeps it off error responses
  // Express might write before any middleware runs.
  app.disable('x-powered-by');

  app.use(createSecurityHeaders());
  app.use(createRequestId());
  app.use(createJsonBodyParser());

  // Ahead of the routers, so a refused origin never reaches a limiter or the guard
  // (`owner-auth.AC12`). It also covers paths no router serves yet: any non-GET under `/cms`.
  const { paths, handler } = container.originAllowList;
  app.use([...paths], handler);

  for (const apiRouter of container.apiRouters) app.use(API_PREFIX, apiRouter.router);

  app.use(notFound);
  app.use(createErrorHandler(container.logger));

  const routes = container.apiRouters.flatMap((apiRouter) =>
    apiRouter.routes.map(({ method, path }) => ({ method, path: `${API_PREFIX}${path}` })),
  );

  return { handler: app, routes };
}
