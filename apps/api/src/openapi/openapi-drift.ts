/**
 * Compares the mounted route table with `openapi/openapi.yaml` (`monorepo-foundation.AC10`).
 *
 * A route that is mounted but undocumented, documented but not mounted, or documented without
 * its spec ID is reported with its method and path. Pure functions over plain data, so the
 * check is testable without a server; `check-drift.ts` is the command-line wrapper.
 *
 * Development tooling only — excluded from the production build.
 */
import { parse } from 'yaml';
import { z } from 'zod';

import type { MountedRoute } from '../app.js';

/** Methods OpenAPI path items may hold; other keys (`summary`, `parameters`) are ignored. */
const OPENAPI_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

/** One documented operation, keyed the same way as a mounted route. */
export interface DocumentedOperation {
  readonly method: string;
  /** OpenAPI path syntax, e.g. `/api/v1/sections/{id}`. */
  readonly path: string;
  readonly specId: string | undefined;
}

export type DriftKind = 'undocumented' | 'unmounted' | 'missing-spec-id';

export interface DriftIssue {
  readonly kind: DriftKind;
  readonly method: string;
  readonly path: string;
  /** Human-readable line naming the method and path. */
  readonly message: string;
}

/** The parts of an OpenAPI document the check reads. */
const documentSchema = z.object({
  openapi: z.string().startsWith('3.1'),
  paths: z.record(z.string(), z.record(z.string(), z.unknown())),
});

const operationSchema = z.object({ 'x-spec-id': z.string().min(1).optional() });

/**
 * Lists the operations in an OpenAPI 3.1 document.
 *
 * @throws {z.ZodError} When the document is not OpenAPI 3.1 or has no `paths` object.
 */
export function readDocumentedOperations(yamlText: string): DocumentedOperation[] {
  const document = documentSchema.parse(parse(yamlText));

  return Object.entries(document.paths).flatMap(([path, pathItem]) =>
    Object.entries(pathItem)
      .filter(([key]) => OPENAPI_METHODS.includes(key))
      .map(([method, operation]) => ({
        method,
        path,
        specId: operationSchema.safeParse(operation).data?.['x-spec-id'],
      })),
  );
}

/** Converts an Express path to OpenAPI syntax: `/sections/:id` → `/sections/{id}`. */
export function toOpenApiPath(expressPath: string): string {
  return expressPath.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

/** Returns every difference between the mounted routes and the document; empty when in sync. */
export function findDrift(
  mounted: readonly MountedRoute[],
  documented: readonly DocumentedOperation[],
): DriftIssue[] {
  const key = (method: string, path: string): string => `${method.toUpperCase()} ${path}`;
  const mountedKeys = new Set(mounted.map((route) => key(route.method, toOpenApiPath(route.path))));
  const documentedKeys = new Set(documented.map((operation) => key(operation.method, operation.path)));

  const issues: DriftIssue[] = [];

  for (const route of mounted) {
    const path = toOpenApiPath(route.path);
    if (!documentedKeys.has(key(route.method, path))) {
      issues.push(issue('undocumented', route.method, path, 'is mounted but not documented'));
    }
  }

  for (const operation of documented) {
    if (!mountedKeys.has(key(operation.method, operation.path))) {
      issues.push(issue('unmounted', operation.method, operation.path, 'is documented but not mounted'));
    } else if (!operation.specId) {
      issues.push(issue('missing-spec-id', operation.method, operation.path, 'has no x-spec-id'));
    }
  }

  return issues;
}

function issue(kind: DriftKind, method: string, path: string, problem: string): DriftIssue {
  return { kind, method, path, message: `${method.toUpperCase()} ${path} ${problem}` };
}
