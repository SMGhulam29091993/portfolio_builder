/**
 * `SessionCookieWriter` over real HTTP: the cookie attributes of the session contract
 * (`owner-auth` spec → Session contract; `owner-auth.AC1`, IT01) in both environments, the
 * clearing headers (`AC6`, `AC11`) and reading the three values back.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import type { SessionTokens } from './auth.types.js';
import { SessionCookieWriter } from './session-cookie-writer.js';

/** Seven days, the cookie and session lifetime of the spec. */
const SEVEN_DAYS_SEC = 7 * 24 * 60 * 60;

const TOKENS: SessionTokens = {
  accessToken: 'header.payload.signature',
  refreshToken: 'refresh-token-value',
  jti: 'jti-value',
};

function writerFor(nodeEnv: 'development' | 'test' | 'production'): SessionCookieWriter {
  return new SessionCookieWriter(
    { NODE_ENV: nodeEnv },
    { apiPath: '/api/v1', authPath: '/api/v1/auth', maxAgeSec: SEVEN_DAYS_SEC },
  );
}

/** An app with one route per writer method; `/read` echoes what the writer read. */
function appFor(writer: SessionCookieWriter): Express {
  const app = express();
  app.post('/write', (_req, res) => {
    writer.write(res, TOKENS);
    res.end();
  });
  app.post('/clear', (_req, res) => {
    writer.clear(res);
    res.end();
  });
  app.get('/read', (req, res) => {
    res.json(writer.read(req));
  });
  return app;
}

/** The `Set-Cookie` lines of a response, keyed by cookie name. */
function setCookies(headers: Record<string, unknown>): Map<string, string> {
  const lines = (headers['set-cookie'] as string[] | undefined) ?? [];
  return new Map(lines.map((line) => [line.slice(0, line.indexOf('=')), line]));
}

describe('SessionCookieWriter.write', () => {
  it('owner-auth.AC1 — sets the three cookies HttpOnly, SameSite=Lax, not Secure, for 7 days outside production', async () => {
    const response = await request(appFor(writerFor('development'))).post('/write');
    const cookies = setCookies(response.headers);

    expect([...cookies.keys()].sort()).toEqual(['access-token', 'jti', 'refresh-token']);
    for (const line of cookies.values()) {
      expect(line).toContain('HttpOnly');
      expect(line).toContain('SameSite=Lax');
      expect(line).toContain(`Max-Age=${String(SEVEN_DAYS_SEC)}`);
      expect(line).not.toContain('Secure');
    }
  });

  it('owner-auth.AC1 — scopes the access token and jti to /api/v1 and the refresh token to /api/v1/auth', async () => {
    const cookies = setCookies((await request(appFor(writerFor('test'))).post('/write')).headers);

    expect(cookies.get('access-token')).toContain(`access-token=${TOKENS.accessToken};`);
    expect(cookies.get('access-token')).toContain('Path=/api/v1;');
    expect(cookies.get('jti')).toContain(`jti=${TOKENS.jti};`);
    expect(cookies.get('jti')).toContain('Path=/api/v1;');
    expect(cookies.get('refresh-token')).toContain(`refresh-token=${TOKENS.refreshToken};`);
    expect(cookies.get('refresh-token')).toContain('Path=/api/v1/auth;');
  });

  it('owner-auth.AC1 — adds Secure and SameSite=Strict in production', async () => {
    const response = await request(appFor(writerFor('production'))).post('/write');

    for (const line of setCookies(response.headers).values()) {
      expect(line).toContain('Secure');
      expect(line).toContain('SameSite=Strict');
      expect(line).toContain('HttpOnly');
    }
  });
});

describe('SessionCookieWriter.clear', () => {
  it('owner-auth.AC6 — expires all three cookies on the paths they were set on', async () => {
    const cookies = setCookies((await request(appFor(writerFor('test'))).post('/clear')).headers);

    expect([...cookies.keys()].sort()).toEqual(['access-token', 'jti', 'refresh-token']);
    expect(cookies.get('access-token')).toContain('Path=/api/v1;');
    expect(cookies.get('jti')).toContain('Path=/api/v1;');
    expect(cookies.get('refresh-token')).toContain('Path=/api/v1/auth;');
    for (const line of cookies.values()) {
      expect(line).toMatch(/^[a-z-]+=;/);
      expect(line).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    }
  });
});

describe('SessionCookieWriter.read', () => {
  it('reads the three session cookies and ignores any other', async () => {
    const response = await request(appFor(writerFor('test')))
      .get('/read')
      .set('Cookie', 'theme=dark; access-token=a.b.c; jti=j-1; refresh-token=r-1');

    expect(response.body).toEqual({ accessToken: 'a.b.c', jti: 'j-1', refreshToken: 'r-1' });
  });

  it('reads absent cookies as undefined', async () => {
    const response = await request(appFor(writerFor('test'))).get('/read');

    expect(response.body).toEqual({});
  });
});
