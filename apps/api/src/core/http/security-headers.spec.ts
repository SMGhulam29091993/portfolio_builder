import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createSecurityHeaders } from './security-headers.js';

describe('createSecurityHeaders', () => {
  it('sets helmet security headers and hides the framework', async () => {
    const app = express();
    app.use(createSecurityHeaders());
    app.get('/', (_req, res) => res.json({}));

    const response = await request(app).get('/');

    expect(response.headers).toEqual(
      expect.objectContaining({
        'content-security-policy': expect.stringContaining("default-src 'self'") as unknown,
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'SAMEORIGIN',
        'strict-transport-security': expect.stringContaining('max-age=') as unknown,
      }),
    );
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});
