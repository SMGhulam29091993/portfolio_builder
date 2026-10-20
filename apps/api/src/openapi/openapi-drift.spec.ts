import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import type { MountedRoute } from '../app.js';
import { findDrift, readDocumentedOperations, toOpenApiPath } from './openapi-drift.js';

const REAL_DOCUMENT = readFileSync(new URL('../../openapi/openapi.yaml', import.meta.url), 'utf8');

/** Builds a minimal OpenAPI 3.1 document from `path → method → x-spec-id` entries. */
function documentWith(paths: Record<string, Record<string, string | undefined>>): string {
  const lines = ['openapi: 3.1.0', 'info: { title: t, version: 0.0.0 }', 'paths:'];
  for (const [path, methods] of Object.entries(paths)) {
    lines.push(`  ${path}:`, '    summary: ignored path-level key');
    for (const [method, specId] of Object.entries(methods)) {
      lines.push(`    ${method}:`, '      responses: {}');
      if (specId) lines.push(`      x-spec-id: ${specId}`);
    }
  }
  return lines.join('\n');
}

const HEALTH: MountedRoute = { method: 'get', path: '/api/v1/health' };

describe('findDrift', () => {
  it('reports nothing when every mounted route is documented with a spec id', () => {
    const documented = readDocumentedOperations(
      documentWith({ '/api/v1/health': { get: 'monorepo-foundation.API01' } }),
    );

    expect(findDrift([HEALTH], documented)).toEqual([]);
  });

  it('monorepo-foundation.IT12 — fails naming the method and path of a mounted route missing from the document', () => {
    const documented = readDocumentedOperations(documentWith({}).replace('paths:', 'paths: {}'));

    expect(findDrift([HEALTH], documented)).toEqual([
      {
        kind: 'undocumented',
        method: 'get',
        path: '/api/v1/health',
        message: 'GET /api/v1/health is mounted but not documented',
      },
    ]);
  });

  it('monorepo-foundation.AC10 — fails naming a documented route that is not mounted', () => {
    const documented = readDocumentedOperations(
      documentWith({
        '/api/v1/health': { get: 'monorepo-foundation.API01' },
        '/api/v1/sections/{id}': { delete: 'section-engine.API05' },
      }),
    );

    expect(findDrift([HEALTH], documented).map((issue) => issue.message)).toEqual([
      'DELETE /api/v1/sections/{id} is documented but not mounted',
    ]);
  });

  it('treats a method mismatch on the same path as drift in both directions', () => {
    const documented = readDocumentedOperations(
      documentWith({ '/api/v1/health': { post: 'monorepo-foundation.API01' } }),
    );

    expect(findDrift([HEALTH], documented).map((issue) => issue.kind)).toEqual([
      'undocumented',
      'unmounted',
    ]);
  });

  it('fails an operation that has no x-spec-id', () => {
    const documented = readDocumentedOperations(documentWith({ '/api/v1/health': { get: undefined } }));

    expect(findDrift([HEALTH], documented).map((issue) => issue.message)).toEqual([
      'GET /api/v1/health has no x-spec-id',
    ]);
  });

  it('matches Express path parameters against OpenAPI templates', () => {
    const documented = readDocumentedOperations(
      documentWith({ '/api/v1/sections/{sectionId}': { patch: 'section-engine.API03' } }),
    );

    expect(findDrift([{ method: 'patch', path: '/api/v1/sections/:sectionId' }], documented)).toEqual([]);
  });
});

describe('toOpenApiPath', () => {
  it('rewrites every :param segment', () => {
    expect(toOpenApiPath('/a/:first/b/:second_id')).toBe('/a/{first}/b/{second_id}');
  });
});

describe('readDocumentedOperations', () => {
  it('rejects a document that is not OpenAPI 3.1', () => {
    expect(() => readDocumentedOperations('openapi: 3.0.3\npaths: {}')).toThrow();
  });

  it('reads the real document', () => {
    expect(readDocumentedOperations(REAL_DOCUMENT)).toEqual([
      { method: 'get', path: '/api/v1/health', specId: 'monorepo-foundation.API01' },
      { method: 'post', path: '/api/v1/auth/login', specId: 'owner-auth.API01' },
      { method: 'post', path: '/api/v1/auth/refresh', specId: 'owner-auth.API02' },
      { method: 'post', path: '/api/v1/auth/logout', specId: 'owner-auth.API03' },
      { method: 'get', path: '/api/v1/auth/me', specId: 'owner-auth.API04' },
      { method: 'post', path: '/api/v1/auth/password/forgot', specId: 'owner-auth.API05' },
      { method: 'post', path: '/api/v1/auth/password/resend', specId: 'owner-auth.API06' },
      { method: 'post', path: '/api/v1/auth/password/reset', specId: 'owner-auth.API07' },
      { method: 'get', path: '/api/v1/auth/registration/options', specId: 'account-registration.API01' },
      { method: 'post', path: '/api/v1/auth/register', specId: 'account-registration.API02' },
      { method: 'post', path: '/api/v1/auth/register/verify', specId: 'account-registration.API03' },
      { method: 'post', path: '/api/v1/auth/verification/request', specId: 'account-registration.API04' },
      { method: 'post', path: '/api/v1/auth/verification/resend', specId: 'account-registration.API05' },
      { method: 'get', path: '/api/v1/auth/google/start', specId: 'google-sign-in.API01' },
      { method: 'get', path: '/api/v1/auth/google/callback', specId: 'google-sign-in.API02' },
      { method: 'get', path: '/api/v1/cms/portfolio', specId: 'section-engine.API01' },
      { method: 'get', path: '/api/v1/cms/portfolio/section-types', specId: 'section-engine.API02' },
      { method: 'put', path: '/api/v1/cms/portfolio/sections/{type}', specId: 'section-engine.API03' },
      { method: 'patch', path: '/api/v1/cms/portfolio/sections/{type}/visibility', specId: 'section-engine.API04' },
      { method: 'put', path: '/api/v1/cms/portfolio/section-order', specId: 'section-engine.API05' },
      { method: 'put', path: '/api/v1/cms/portfolio/slug', specId: 'section-engine.API06' },
      { method: 'post', path: '/api/v1/cms/assets', specId: 'media-assets.API01' },
      { method: 'get', path: '/api/v1/cms/assets', specId: 'media-assets.API02' },
      { method: 'delete', path: '/api/v1/cms/assets/{id}', specId: 'media-assets.API03' },
      { method: 'get', path: '/api/v1/cms/assets/{id}/content', specId: 'media-assets.API04' },
      { method: 'get', path: '/api/v1/cms/identity', specId: 'site-identity.API01' },
      { method: 'put', path: '/api/v1/cms/identity', specId: 'site-identity.API02' },
      { method: 'get', path: '/api/v1/cms/design', specId: 'design-theme.API01' },
      { method: 'put', path: '/api/v1/cms/design', specId: 'design-theme.API02' },
      { method: 'post', path: '/api/v1/cms/design/reset', specId: 'design-theme.API03' },
      { method: 'get', path: '/api/v1/cms/publishing/status', specId: 'publish-pipeline.API01' },
      { method: 'post', path: '/api/v1/cms/publishing/validate', specId: 'publish-pipeline.API02' },
      { method: 'post', path: '/api/v1/cms/publishing/publish', specId: 'publish-pipeline.API03' },
      { method: 'get', path: '/api/v1/cms/publishing/snapshots', specId: 'publish-pipeline.API04' },
      { method: 'post', path: '/api/v1/cms/publishing/snapshots/{version}/activate', specId: 'publish-pipeline.API05' },
      { method: 'post', path: '/api/v1/cms/publishing/revalidate', specId: 'publish-pipeline.API06' },
    ]);
  });
});
