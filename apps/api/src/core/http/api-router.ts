/**
 * Express router that records every route it registers.
 *
 * Express 5 does not keep the paths routers are mounted at, so the mounted route table cannot be
 * read back from the app reliably. Each module's router factory registers its routes through
 * `ApiRouter.route()` instead of `router.get()` & co.; the app factory then knows exactly which
 * method + path pairs are live, and the OpenAPI drift check compares that table with
 * `openapi/openapi.yaml` (`monorepo-foundation.AC10`).
 */
import express, { type RequestHandler, type Router } from 'express';

/** HTTP methods a module route may use. */
export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

/** One registered route, with the path relative to the router's mount point. */
export interface RouteEntry {
  readonly method: HttpMethod;
  /** Express path syntax, e.g. `/sections/:id`. */
  readonly path: string;
}

export class ApiRouter {
  /** The Express router to mount. */
  readonly router: Router = express.Router();

  private readonly entries: RouteEntry[] = [];

  /** Routes registered so far, in registration order. */
  get routes(): readonly RouteEntry[] {
    return this.entries;
  }

  /**
   * Registers a route on the underlying router and records it.
   *
   * @param handlers - Middleware in order (rate limiter, `validate(...)`, …), controller last.
   */
  route(method: HttpMethod, path: string, ...handlers: RequestHandler[]): this {
    this.router[method](path, ...handlers);
    this.entries.push({ method, path });
    return this;
  }
}
