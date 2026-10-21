/**
 * A local OpenID Connect issuer standing in for Google in tests (`google-sign-in.T02`, `T03`;
 * spec → Non-Functional Constraints: no real Google in tests).
 *
 * Serves the three things `OidcProvider` reads — the discovery document, the token endpoint and
 * the JWKS — on `127.0.0.1` with an RS256 key pair generated per instance. A test registers what
 * the next code should yield with `issueCode(...)`; the token endpoint checks the client
 * credentials, the redirect URL and the PKCE verifier exactly as Google does, and answers with
 * an ID token signed by this issuer (or by a stranger's key, or with altered claims, when a
 * test asks for a broken token).
 *
 * Test-only: excluded from the build.
 */
import { createHash, randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose';

/** The claims a code yields, plus deliberate faults for negative tests. */
export interface IssuedCode {
  readonly sub: string;
  readonly email: string;
  readonly emailVerified?: boolean;
  readonly name?: string;
  /** The nonce the flow sent; the issuer echoes it into the token unless overridden. */
  readonly nonce: string;
  /** The PKCE challenge the flow sent (S256 of the verifier). */
  readonly codeChallenge: string;
  /** Faults to inject into the ID token. */
  readonly fault?: 'wrong-audience' | 'wrong-issuer' | 'expired' | 'foreign-key';
}

export const LOCAL_CLIENT_ID = 'local-client-id';
export const LOCAL_CLIENT_SECRET = 'local-client-secret';

export class LocalOidcIssuer {
  private readonly codes = new Map<string, IssuedCode>();
  /** How many times the discovery document was served. */
  discoveryRequests = 0;

  private constructor(
    private readonly server: Server,
    readonly issuer: string,
    private readonly privateKey: CryptoKey,
    private readonly foreignKey: CryptoKey,
    private readonly publicJwk: Record<string, unknown>,
    readonly redirectUrl: string,
  ) {}

  /** Starts the issuer on an ephemeral loopback port. */
  static async start(redirectUrl: string): Promise<LocalOidcIssuer> {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const foreign = await generateKeyPair('RS256');
    const publicJwk = { ...(await exportJWK(publicKey)), kid: 'local-key', alg: 'RS256', use: 'sig' };

    let handler: (req: IncomingMessage, res: ServerResponse) => void = () => undefined;
    const server = createServer((req, res) => {
      handler(req, res);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    const issuer = new LocalOidcIssuer(
      server,
      `http://127.0.0.1:${String(port)}`,
      privateKey,
      foreign.privateKey,
      publicJwk,
      redirectUrl,
    );
    handler = (req, res) => {
      void issuer.handle(req, res);
    };
    return issuer;
  }

  /** Registers a one-time code that the token endpoint will redeem for these claims. */
  issueCode(claims: IssuedCode): string {
    const code = randomBytes(16).toString('hex');
    this.codes.set(code, claims);
    return code;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', this.issuer);
    if (req.method === 'GET' && url.pathname === '/.well-known/openid-configuration') {
      this.discoveryRequests += 1;
      json(res, 200, {
        issuer: this.issuer,
        authorization_endpoint: `${this.issuer}/authorize`,
        token_endpoint: `${this.issuer}/token`,
        jwks_uri: `${this.issuer}/jwks`,
      }); return;
    }
    if (req.method === 'GET' && url.pathname === '/jwks') {
      json(res, 200, { keys: [this.publicJwk] }); return;
    }
    if (req.method === 'POST' && url.pathname === '/token') {
      return this.token(await readBody(req), res);
    }
    json(res, 404, { error: 'not_found' });
  }

  private async token(body: string, res: ServerResponse): Promise<void> {
    const form = new URLSearchParams(body);
    const code = form.get('code') ?? '';
    const issued = this.codes.get(code);
    this.codes.delete(code);
    const verifier = form.get('code_verifier') ?? '';
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    if (
      !issued ||
      form.get('grant_type') !== 'authorization_code' ||
      form.get('client_id') !== LOCAL_CLIENT_ID ||
      form.get('client_secret') !== LOCAL_CLIENT_SECRET ||
      form.get('redirect_uri') !== this.redirectUrl ||
      challenge !== issued.codeChallenge
    ) {
      json(res, 400, { error: 'invalid_grant' }); return;
    }

    const nowSec = Math.floor(Date.now() / 1_000);
    const token = await new SignJWT({
      email: issued.email,
      email_verified: issued.emailVerified ?? true,
      nonce: issued.nonce,
      ...(issued.name === undefined ? {} : { name: issued.name }),
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'local-key' })
      .setSubject(issued.sub)
      .setIssuer(issued.fault === 'wrong-issuer' ? 'https://elsewhere.example' : this.issuer)
      .setAudience(issued.fault === 'wrong-audience' ? 'another-client' : LOCAL_CLIENT_ID)
      .setIssuedAt(issued.fault === 'expired' ? nowSec - 7_200 : nowSec)
      .setExpirationTime(issued.fault === 'expired' ? nowSec - 3_600 : nowSec + 3_600)
      .sign(issued.fault === 'foreign-key' ? this.foreignKey : this.privateKey);
    json(res, 200, { access_token: 'unused', token_type: 'Bearer', id_token: token });
  }
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => { resolve(Buffer.concat(chunks).toString('utf8')); });
    req.on('error', reject);
  });
}
