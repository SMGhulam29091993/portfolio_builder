/**
 * `validate()` through real Express routing — the middleware is exercised exactly as a module's
 * router will mount it, in front of a controller handler.
 */
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { ILogger } from '../logger/logger.interface.js';
import { createErrorHandler } from './error-handler.js';
import { createJsonBodyParser } from './json-body.js';
import { validate } from './validate.js';

const silentLogger: ILogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const createProjectBody = z.object({
  title: z.string().min(1),
  year: z.coerce.number().int(),
  tags: z.array(z.string()).default([]),
});

/** Mounts `validate(...)` in front of `handler` and the real error middleware. */
function appWith(path: string, guard: RequestHandler, handler: RequestHandler): express.Express {
  const app = express();
  app.use(createJsonBodyParser());
  app.all(path, guard, handler);
  app.use(createErrorHandler(silentLogger));
  return app;
}

describe('validate', () => {
  it('monorepo-foundation.UT05 — rejects a failing body with every path and never runs the controller', async () => {
    const controller = vi.fn<RequestHandler>((_req, res) => res.end());
    const app = appWith('/projects', validate(createProjectBody), controller);

    const response = await request(app).post('/projects').send({ title: '', year: 'soon' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: 'Request validation failed',
      data: {
        code: 'VALIDATION_FAILED',
        errors: [
          { path: 'title', message: expect.any(String) as unknown },
          { path: 'year', message: expect.any(String) as unknown },
        ],
      },
    });
    expect(controller).not.toHaveBeenCalled();
  });

  it('monorepo-foundation.UT06 — stores the parsed value on req.validatedBody', async () => {
    let seen: unknown;
    const app = appWith('/projects', validate(createProjectBody), (req, res) => {
      seen = req.validatedBody;
      res.end();
    });

    await request(app).post('/projects').send({ title: 'Second Brain', year: '2025', extra: 1 });

    // Coercion and defaults applied; the unknown key is stripped.
    expect(seen).toEqual({ title: 'Second Brain', year: 2025, tags: [] });
  });

  it('validates the query string into req.validatedQuery', async () => {
    let seen: unknown;
    const pageQuery = z.object({ page: z.coerce.number().int().min(1) });
    const app = appWith('/projects', validate(pageQuery, 'query'), (req, res) => {
      seen = req.validatedQuery;
      res.end();
    });

    await request(app).get('/projects?page=3').expect(200);
    const rejected = await request(app).get('/projects?page=0');

    expect(seen).toEqual({ page: 3 });
    expect(rejected.status).toBe(400);
  });

  it('validates route params into req.validatedParams', async () => {
    let seen: unknown;
    const idParams = z.object({ id: z.string().length(4) });
    const app = appWith('/projects/:id', validate(idParams, 'params'), (req, res) => {
      seen = req.validatedParams;
      res.end();
    });

    await request(app).get('/projects/ab12').expect(200);

    expect(seen).toEqual({ id: 'ab12' });
  });

  it('rejects a missing body as VALIDATION_FAILED', async () => {
    const app = appWith('/projects', validate(createProjectBody), (_req, res) => res.end());

    const response = await request(app).post('/projects');

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({ data: expect.objectContaining({ code: 'VALIDATION_FAILED' }) as unknown }),
    );
  });
});
