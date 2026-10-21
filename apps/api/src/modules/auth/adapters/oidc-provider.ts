/**
 * `IOidcProvider` for Google — or any OpenID Connect issuer (`google-sign-in.T02`; ADR-0011).
 *
 * Endpoints come from the issuer's discovery document
 * (`<GOOGLE_ISSUER>/.well-known/openid-configuration`), so no provider URL is a literal in code
 * (`constitution.md` → Secrets); tests point the issuer at a local server. The document is read
 * once per process; a failed read is forgotten so the next sign-in retries it.
 *
 * The ID token is verified with `jose` against the issuer's published keys (cached by
 * `createRemoteJWKSet`): signature, `iss`, `aud` = client id, `exp` (60-second leeway), and the
 * `nonce` this flow minted. Every failure — network, a refused code, a bad token — is an
 * `UpstreamError` with `provider: "google"`; no `jose` or fetch error crosses the port. Nothing
 * here is logged: the code, verifier, tokens and email are all secret or personal.
 */
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { z } from 'zod';

import { ServiceUnavailableError, UpstreamError } from '../../../core/errors/index.js';
import type { IOidcProvider, OidcAuthorizationRequest, OidcIdentity } from '../auth.interface.js';

/** The provider name on `UPSTREAM_FAILED`. */
const PROVIDER = 'google';

/** What the flow asks for (spec → Flow, step 1). */
const SCOPE = 'openid email profile';

/** Upper bound on each call to the issuer, so a hung issuer cannot hold a request open. */
const REQUEST_TIMEOUT_MS = 10_000;

/** Clock skew tolerated on the ID token's `exp` / `iat`. */
const CLOCK_TOLERANCE_SEC = 60;

const discoverySchema = z.object({
  issuer: z.string().min(1),
  authorization_endpoint: z.url(),
  token_endpoint: z.url(),
  jwks_uri: z.url(),
});

const tokenResponseSchema = z.object({ id_token: z.string().min(1) });

const idTokenClaimsSchema = z.object({
  sub: z.string().min(1),
  email: z.string().min(1),
  email_verified: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
  name: z.string().optional(),
  nonce: z.string().min(1),
});

/** The configured issuer and client; built by the container from `Env`. */
export interface OidcProviderOptions {
  /** `GOOGLE_ISSUER` — e.g. `https://accounts.google.com`. */
  readonly issuer: string;
  readonly clientId: string;
  /** A secret: sent only in the token request body, never logged. */
  readonly clientSecret: string;
  /** `GOOGLE_REDIRECT_URL` — the callback (API02) as the browser reaches it. */
  readonly redirectUrl: string;
}

/** The endpoints and key set read from discovery. */
interface Discovered {
  readonly issuer: string;
  readonly authorizationEndpoint: string;
  readonly tokenEndpoint: string;
  readonly keys: JWTVerifyGetKey;
}

export class OidcProvider implements IOidcProvider {
  private discovered?: Promise<Discovered>;

  constructor(private readonly options: OidcProviderOptions) {}

  isEnabled(): boolean {
    return true;
  }

  async authorizationUrl({ state, nonce, codeChallenge }: OidcAuthorizationRequest): Promise<string> {
    const { authorizationEndpoint } = await this.discover();
    const url = new URL(authorizationEndpoint);
    url.search = new URLSearchParams({
      response_type: 'code',
      scope: SCOPE,
      client_id: this.options.clientId,
      redirect_uri: this.options.redirectUrl,
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    }).toString();
    return url.toString();
  }

  async exchange(code: string, codeVerifier: string, expectedNonce: string): Promise<OidcIdentity> {
    const discovered = await this.discover();
    const idToken = await this.redeem(discovered.tokenEndpoint, code, codeVerifier);

    let payload: unknown;
    try {
      ({ payload } = await jwtVerify(idToken, discovered.keys, {
        issuer: discovered.issuer,
        audience: this.options.clientId,
        clockTolerance: CLOCK_TOLERANCE_SEC,
      }));
    } catch {
      throw new UpstreamError(PROVIDER);
    }

    const claims = idTokenClaimsSchema.safeParse(payload);
    // The nonce binds the token to this browser's flow; a token minted for another flow fails.
    if (!claims.success || claims.data.nonce !== expectedNonce) throw new UpstreamError(PROVIDER);

    const { sub, email, email_verified: verified, name } = claims.data;
    return {
      sub,
      email: email.toLowerCase(),
      emailVerified: verified === true || verified === 'true',
      ...(name ? { name } : {}),
    };
  }

  /** Posts the code and verifier to the token endpoint; returns the raw ID token. */
  private async redeem(tokenEndpoint: string, code: string, codeVerifier: string): Promise<string> {
    let body: unknown;
    try {
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.options.redirectUrl,
          client_id: this.options.clientId,
          client_secret: this.options.clientSecret,
          code_verifier: codeVerifier,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error('token endpoint refused the code');
      body = await response.json();
    } catch {
      throw new UpstreamError(PROVIDER);
    }
    const parsed = tokenResponseSchema.safeParse(body);
    if (!parsed.success) throw new UpstreamError(PROVIDER);
    return parsed.data.id_token;
  }

  /** The discovery document, read once; a failure is forgotten so the next call retries. */
  private discover(): Promise<Discovered> {
    this.discovered ??= this.readDiscovery().catch((error: unknown) => {
      this.discovered = undefined;
      throw error;
    });
    return this.discovered;
  }

  private async readDiscovery(): Promise<Discovered> {
    const location = `${this.options.issuer.replace(/\/+$/, '')}/.well-known/openid-configuration`;
    let body: unknown;
    try {
      const response = await fetch(location, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!response.ok) throw new Error('discovery unavailable');
      body = await response.json();
    } catch {
      throw new UpstreamError(PROVIDER);
    }
    const parsed = discoverySchema.safeParse(body);
    if (!parsed.success) throw new UpstreamError(PROVIDER);
    return {
      issuer: parsed.data.issuer,
      authorizationEndpoint: parsed.data.authorization_endpoint,
      tokenEndpoint: parsed.data.token_endpoint,
      keys: createRemoteJWKSet(new URL(parsed.data.jwks_uri), {
        timeoutDuration: REQUEST_TIMEOUT_MS,
      }),
    };
  }
}

/**
 * The provider when Google is not configured (`google-sign-in.AC9`): reports itself disabled,
 * and every call is 503 — the routes turn that into a `google_unavailable` redirect.
 */
export class DisabledOidcProvider implements IOidcProvider {
  isEnabled(): boolean {
    return false;
  }

  authorizationUrl(): Promise<string> {
    return Promise.reject(new ServiceUnavailableError({}, 'Google sign-in is not configured'));
  }

  exchange(): Promise<OidcIdentity> {
    return Promise.reject(new ServiceUnavailableError({}, 'Google sign-in is not configured'));
  }
}
