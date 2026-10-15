import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { ApiRouter } from './api-router.js';

describe('ApiRouter', () => {
  it('registers each route on the Express router and records it', async () => {
    const api = new ApiRouter()
      .route('get', '/items', (_req, res) => res.json(['list']))
      .route('post', '/items/:id', (req, res) => res.json({ id: req.params.id }));
    const app = express().use('/api/v1', api.router);

    expect(api.routes).toEqual([
      { method: 'get', path: '/items' },
      { method: 'post', path: '/items/:id' },
    ]);
    await request(app).get('/api/v1/items').expect(200, ['list']);
    await request(app).post('/api/v1/items/a1').expect(200, { id: 'a1' });
  });

  it('runs middleware before the final handler', async () => {
    const order: string[] = [];
    const api = new ApiRouter().route(
      'get',
      '/',
      (_req, _res, next) => {
        order.push('guard');
        next();
      },
      (_req, res) => {
        order.push('controller');
        res.end();
      },
    );

    await request(express().use(api.router)).get('/').expect(200);

    expect(order).toEqual(['guard', 'controller']);
  });
});
