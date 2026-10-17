import { describe, expect, it } from 'vitest';

import { createApiRewrites } from './api-proxy';

describe('createApiRewrites', () => {
  it('monorepo-foundation.AC12 — forwards every /api/v1 path to the API unchanged', () => {
    expect(createApiRewrites('http://127.0.0.1:4000')).toEqual([
      { source: '/api/v1/:path*', destination: 'http://127.0.0.1:4000/api/v1/:path*' },
    ]);
  });

  it('keeps a path prefix and drops trailing slashes from the base URL', () => {
    expect(createApiRewrites('https://internal.example/backend//')).toEqual([
      {
        source: '/api/v1/:path*',
        destination: 'https://internal.example/backend/api/v1/:path*',
      },
    ]);
  });
});
