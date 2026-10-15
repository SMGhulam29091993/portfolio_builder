import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createRequestId } from './request-id.js';

/** App that echoes the id the middleware attached to the request. */
function appWithIds(ids: string[]): express.Express {
  const app = express();
  app.use(createRequestId(() => ids.shift() ?? 'exhausted'));
  app.get('/', (req, res) => {
    res.json({ requestId: req.requestId });
  });
  return app;
}

describe('createRequestId', () => {
  it('assigns a new id and echoes it in X-Request-Id', async () => {
    const response = await request(appWithIds(['generated-1'])).get('/');

    expect(response.body).toEqual({ requestId: 'generated-1' });
    expect(response.headers['x-request-id']).toBe('generated-1');
  });

  it('reuses a well-formed incoming id', async () => {
    const response = await request(appWithIds(['unused']))
      .get('/')
      .set('X-Request-Id', 'web-7f3a_2.b');

    expect(response.body).toEqual({ requestId: 'web-7f3a_2.b' });
  });

  it.each([
    ['contains a space', 'id with space'],
    ['contains a log-forging quote', 'abc"},{"level":"error'],
    ['is longer than 128 characters', 'a'.repeat(129)],
  ])('replaces an incoming id that %s', async (_reason, incoming) => {
    const response = await request(appWithIds(['generated-2'])).get('/').set('X-Request-Id', incoming);

    expect(response.body).toEqual({ requestId: 'generated-2' });
  });

  it('generates a UUID by default', async () => {
    const app = express();
    app.use(createRequestId());
    app.get('/', (req, res) => res.json({ requestId: req.requestId }));

    const response = await request(app).get('/');

    expect(response.body).toEqual({
      requestId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/) as unknown,
    });
  });
});
