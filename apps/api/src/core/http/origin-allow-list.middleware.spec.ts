/**
 * `OriginAllowListMiddleware` over real HTTP, in front of the real error middleware
 * (`owner-auth.T06`; `owner-auth.AC12`). The full-stack check on the mounted auth routes is
 * `owner-auth.IT12` in `modules/auth/auth.routes.spec.ts`.
 */
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import type { ILogger } from '../logger/logger.interface.js';
import { createErrorHandler } from './error-handler.js';
import { OriginAllowListMiddleware } from './origin-allow-list.middleware.js';
import { ok } from './respond.js';

const WEB_ORIGIN = 'http://127.0.0.1:3000';

const silentLogger: ILogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

/** An app with the allow-list in front of a handler that answers for every method. */
function appBehindAllowList(): express.Express {
  const app = express();
  app.use(new OriginAllowListMiddleware({ WEB_ORIGIN }).handle);
  app.all('/target', (_req, res) => {
    ok(res, 'reached');
  });
  app.use(createErrorHandler(silentLogger));
  return app;
}

const FORBIDDEN_BODY = {
  success: false,
  message: 'Request origin is not allowed',
  data: { code: 'ORIGIN_NOT_ALLOWED' },
};

describe('OriginAllowListMiddleware', () => {
  it.each(['post', 'put', 'patch', 'delete'] as const)(
    'owner-auth.AC12 — lets a %s from WEB_ORIGIN through',
    async (method) => {
      await request(appBehindAllowList())[method]('/target').set('Origin', WEB_ORIGIN).expect(200);
    },
  );

  it('owner-auth.AC12 — 403 ORIGIN_NOT_ALLOWED for a non-GET with no Origin header', async () => {
    const response = await request(appBehindAllowList()).post('/target');

    expect(response.status).toBe(403);
    expect(response.body).toEqual(FORBIDDEN_BODY);
  });

  it.each([
    ['a foreign origin', 'https://attacker.example'],
    ['another port', 'http://127.0.0.1:3001'],
    ['another scheme', 'https://127.0.0.1:3000'],
    ['localhost for 127.0.0.1', 'http://localhost:3000'],
    ['a trailing slash', `${WEB_ORIGIN}/`],
    ['the opaque origin', 'null'],
  ])('owner-auth.AC12 — 403 ORIGIN_NOT_ALLOWED for %s', async (_case, origin) => {
    const response = await request(appBehindAllowList()).post('/target').set('Origin', origin);

    expect(response.status).toBe(403);
    expect(response.body).toEqual(FORBIDDEN_BODY);
  });

  it.each(['get', 'head'] as const)('does not check a %s', async (method) => {
    await request(appBehindAllowList())[method]('/target').expect(200);
    await request(appBehindAllowList())[method]('/target').set('Origin', 'https://attacker.example').expect(200);
  });
});
