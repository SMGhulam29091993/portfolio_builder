/**
 * `OidcProvider` against a local issuer with its own keys (`google-sign-in.UT03`; AC1, AC6).
 * No request reaches Google.
 */
import { createHash } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ServiceUnavailableError, UpstreamError } from '../../../core/errors/index.js';
import {
  LOCAL_CLIENT_ID,
  LOCAL_CLIENT_SECRET,
  LocalOidcIssuer,
  type IssuedCode,
} from '../../../testing/index.js';
import { DisabledOidcProvider, OidcProvider } from './oidc-provider.js';

const REDIRECT_URL = 'http://127.0.0.1:3100/api/v1/auth/google/callback';
const VERIFIER = 'v'.repeat(43);
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');
const NONCE = 'the-flow-nonce';

let issuer: LocalOidcIssuer;
let provider: OidcProvider;

beforeAll(async () => {
  issuer = await LocalOidcIssuer.start(REDIRECT_URL);
  provider = new OidcProvider({
    issuer: issuer.issuer,
    clientId: LOCAL_CLIENT_ID,
    clientSecret: LOCAL_CLIENT_SECRET,
    redirectUrl: REDIRECT_URL,
  });
});

afterAll(async () => {
  await issuer.stop();
});

function code(overrides: Partial<IssuedCode> = {}): string {
  return issuer.issueCode({
    sub: 'sub-123',
    email: 'Person@Example.TEST',
    name: 'A Person',
    nonce: NONCE,
    codeChallenge: CHALLENGE,
    ...overrides,
  });
}

describe('OidcProvider (google-sign-in.UT03)', () => {
  it('google-sign-in.AC1 — builds the authorization URL with every flow parameter', async () => {
    const url = new URL(
      await provider.authorizationUrl({ state: 'st', nonce: NONCE, codeChallenge: CHALLENGE }),
    );

    expect(`${url.origin}${url.pathname}`).toBe(`${issuer.issuer}/authorize`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      scope: 'openid email profile',
      client_id: LOCAL_CLIENT_ID,
      redirect_uri: REDIRECT_URL,
      state: 'st',
      nonce: NONCE,
      code_challenge: CHALLENGE,
      code_challenge_method: 'S256',
    });
  });

  it('reads the discovery document once per process', async () => {
    const before = issuer.discoveryRequests;
    await provider.authorizationUrl({ state: 'a', nonce: 'b', codeChallenge: 'c' });
    await provider.exchange(code(), VERIFIER, NONCE);

    expect(issuer.discoveryRequests).toBe(before);
  });

  it('exchanges a code for the verified identity, email lower-cased', async () => {
    await expect(provider.exchange(code(), VERIFIER, NONCE)).resolves.toEqual({
      sub: 'sub-123',
      email: 'person@example.test',
      emailVerified: true,
      name: 'A Person',
    });
  });

  it('reports an unverified email as such', async () => {
    const identity = await provider.exchange(code({ emailVerified: false }), VERIFIER, NONCE);

    expect(identity.emailVerified).toBe(false);
  });

  it.each([
    ['a wrong nonce', () => provider.exchange(code({ nonce: 'other' }), VERIFIER, NONCE)],
    ['a wrong audience', () => provider.exchange(code({ fault: 'wrong-audience' }), VERIFIER, NONCE)],
    ['a wrong issuer', () => provider.exchange(code({ fault: 'wrong-issuer' }), VERIFIER, NONCE)],
    ['an expired token', () => provider.exchange(code({ fault: 'expired' }), VERIFIER, NONCE)],
    ['a token signed by another key', () => provider.exchange(code({ fault: 'foreign-key' }), VERIFIER, NONCE)],
    ['a wrong PKCE verifier', () => provider.exchange(code(), 'w'.repeat(43), NONCE)],
    ['an unknown code', () => provider.exchange('never-issued', VERIFIER, NONCE)],
  ])('google-sign-in.AC6 — rejects %s as UPSTREAM_FAILED (google)', async (_case, call) => {
    const error = await call().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(UpstreamError);
    expect(error).toMatchObject({ details: { provider: 'google' } });
  });

  it('answers UPSTREAM_FAILED when the issuer cannot be reached', async () => {
    const unreachable = new OidcProvider({
      issuer: 'http://127.0.0.1:9',
      clientId: LOCAL_CLIENT_ID,
      clientSecret: LOCAL_CLIENT_SECRET,
      redirectUrl: REDIRECT_URL,
    });

    await expect(
      unreachable.authorizationUrl({ state: 'a', nonce: 'b', codeChallenge: 'c' }),
    ).rejects.toBeInstanceOf(UpstreamError);
  });
});

describe('DisabledOidcProvider (google-sign-in.AC9)', () => {
  it('reports itself disabled and answers 503 to every call', async () => {
    const disabled = new DisabledOidcProvider();

    expect(disabled.isEnabled()).toBe(false);
    await expect(
      disabled.authorizationUrl(),
    ).rejects.toBeInstanceOf(ServiceUnavailableError);
    await expect(disabled.exchange()).rejects.toBeInstanceOf(ServiceUnavailableError);
  });
});
