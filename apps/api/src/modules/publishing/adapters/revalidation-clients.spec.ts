/**
 * `publish-pipeline.CT03` — `IRevalidationClient` (HTTP against a real local server, and no-op).
 */
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { HttpRevalidationClient } from './http-revalidation.client.js';
import { NoopRevalidationClient } from './noop-revalidation.client.js';

const SECRET = 'revalidate-secret-for-tests-000000000000';

let server: Server;
let url: string;
let answer = 200;
let delayMs = 0;
const received: { headers: IncomingHttpHeaders; body: string }[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk: Buffer) => (body += chunk.toString()));
    req.on('end', () => {
      received.push({ headers: req.headers, body });
      setTimeout(() => res.writeHead(answer).end(), delayMs);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}/api/revalidate`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

describe('publish-pipeline.CT03 — revalidation clients', () => {
  it('HTTP: posts the slug with the secret header; 2xx is ok', async () => {
    answer = 200;
    const client = new HttpRevalidationClient({ url, secret: SECRET, timeoutMs: 1_000 });
    expect(await client.revalidate('ada')).toBe('ok');
    expect(received.at(-1)?.headers['x-revalidate-secret']).toBe(SECRET);
    expect(JSON.parse(received.at(-1)?.body ?? '')).toEqual({ slug: 'ada' });
  });

  it('HTTP: a 500, a timeout and an unreachable server are failed, never thrown', async () => {
    answer = 500;
    expect(await new HttpRevalidationClient({ url, secret: SECRET, timeoutMs: 1_000 }).revalidate('ada')).toBe('failed');
    answer = 200;
    delayMs = 300;
    expect(await new HttpRevalidationClient({ url, secret: SECRET, timeoutMs: 50 }).revalidate('ada')).toBe('failed');
    delayMs = 0;
    expect(await new HttpRevalidationClient({ url: 'http://127.0.0.1:1/none', secret: SECRET, timeoutMs: 500 }).revalidate('ada')).toBe('failed');
  });

  it('no-op: ok without any call', async () => {
    const before = received.length;
    expect(await new NoopRevalidationClient().revalidate()).toBe('ok');
    expect(received).toHaveLength(before);
  });
});
