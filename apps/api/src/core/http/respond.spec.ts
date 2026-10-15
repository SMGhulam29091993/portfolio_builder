import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { accepted, created, ok } from './respond.js';

const app = express();
app.get('/ok', (_req, res) => {
  ok(res, 'fetched', { id: 'a1' });
});
app.get('/ok-empty', (_req, res) => {
  ok(res, 'done');
});
app.post('/created', (_req, res) => {
  created(res, 'created', { id: 'a2' });
});
app.post('/accepted', (_req, res) => {
  accepted(res, 'queued', { jobId: 'j1' });
});

describe('respond helpers', () => {
  it.each([
    ['get', '/ok', 200, { success: true, message: 'fetched', data: { id: 'a1' } }],
    ['post', '/created', 201, { success: true, message: 'created', data: { id: 'a2' } }],
    ['post', '/accepted', 202, { success: true, message: 'queued', data: { jobId: 'j1' } }],
  ] as const)('%s %s answers %i in the standard envelope', async (method, path, status, body) => {
    const response = await request(app)[method](path);

    expect(response.status).toBe(status);
    expect(response.body).toEqual(body);
  });

  it('omits data when there is none', async () => {
    const response = await request(app).get('/ok-empty');

    expect(response.body).toEqual({ success: true, message: 'done' });
  });
});
