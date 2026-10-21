/**
 * Service tests for `GoogleSignInService` with fakes (`google-sign-in.UT01`, `UT02`). The
 * provider is a scripted fake of `IOidcProvider`; the real adapter is covered in
 * `adapters/oidc-provider.spec.ts`, the whole flow in `google-sign-in.routes.spec.ts`.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { UpstreamError } from '../../core/errors/index.js';
import {
  InMemoryOAuthStateStore,
  InMemoryUserRepository,
  ManualClock,
  SequenceSecureRandom,
} from '../../testing/index.js';
import { GoogleSignInError } from './auth.errors.js';
import type {
  IOidcProvider,
  ISessionStarter,
  OidcAuthorizationRequest,
  OidcIdentity,
} from './auth.interface.js';
import type { SignedInSession, User } from './auth.types.js';
import { GoogleSignInService } from './google-sign-in.service.js';

/** Answers `exchange` with whatever identity the test scripted; records the requests. */
class ScriptedProvider implements IOidcProvider {
  identity: OidcIdentity | Error = { sub: 's', email: 'e@example.test', emailVerified: true };
  lastRequest?: OidcAuthorizationRequest;
  enabled = true;

  isEnabled(): boolean {
    return this.enabled;
  }

  authorizationUrl(request: OidcAuthorizationRequest): Promise<string> {
    this.lastRequest = request;
    return Promise.resolve(`https://issuer.example/authorize?state=${request.state}`);
  }

  exchange(_code: string, _verifier: string, nonce: string): Promise<OidcIdentity> {
    if (this.identity instanceof Error) return Promise.reject(this.identity);
    if (nonce !== this.lastRequest?.nonce) return Promise.reject(new UpstreamError('google'));
    return Promise.resolve(this.identity);
  }
}

class RecordingStarter implements ISessionStarter {
  readonly started: User[] = [];
  startFor(user: User): Promise<SignedInSession> {
    this.started.push(user);
    return Promise.resolve({
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
      tokens: { accessToken: 'a', refreshToken: 'r', jti: 'j' },
    });
  }
}

let clock: ManualClock;
let users: InMemoryUserRepository;
let provider: ScriptedProvider;
let starter: RecordingStarter;
let service: GoogleSignInService;

beforeEach(() => {
  clock = new ManualClock();
  users = new InMemoryUserRepository(() => clock.now());
  provider = new ScriptedProvider();
  starter = new RecordingStarter();
  service = new GoogleSignInService(
    provider,
    new InMemoryOAuthStateStore({ ttlSec: 600 }, () => clock.now().getTime()),
    users,
    users,
    users,
    starter,
    new SequenceSecureRandom(),
    clock,
  );
});

/** Runs start and a matching callback, returning the session or the failure reason. */
async function signIn(identity: OidcIdentity) {
  provider.identity = identity;
  const { state } = await service.start();
  return service.complete({ code: 'code', state, cookieState: state });
}

async function reasonOf(promise: Promise<unknown>): Promise<string | undefined> {
  const error = await promise.catch((caught: unknown) => caught);
  return error instanceof GoogleSignInError ? error.reason : undefined;
}

describe('start', () => {
  it('sends an S256 challenge, not the verifier, and distinct state and nonce', async () => {
    const { state, redirectUrl } = await service.start();

    expect(redirectUrl).toContain(state);
    expect(provider.lastRequest?.state).toBe(state);
    expect(provider.lastRequest?.nonce).not.toBe(state);
    expect(provider.lastRequest?.codeChallenge).toMatch(/^[\w-]{43}$/);
  });

  it('google-sign-in.AC9 — is google_unavailable when disabled', async () => {
    provider.enabled = false;

    await expect(reasonOf(service.start())).resolves.toBe('google_unavailable');
  });
});

describe('complete — state (google-sign-in.UT02)', () => {
  it.each([
    ['no cookie', (state: string) => ({ code: 'c', state })],
    ['a different cookie', (state: string) => ({ code: 'c', state, cookieState: 'other' })],
    ['no code', (state: string) => ({ state, cookieState: state })],
  ])('google-sign-in.AC5 — refuses %s as google_state', async (_case, build) => {
    const { state } = await service.start();

    await expect(reasonOf(service.complete(build(state)))).resolves.toBe('google_state');
  });

  it('google-sign-in.AC5 — a replayed callback is google_state', async () => {
    const { state } = await service.start();
    await service.complete({ code: 'c', state, cookieState: state });

    await expect(
      reasonOf(service.complete({ code: 'c', state, cookieState: state })),
    ).resolves.toBe('google_state');
  });

  it('an expired state is google_state', async () => {
    const { state } = await service.start();
    clock.advance(600_000);

    await expect(
      reasonOf(service.complete({ code: 'c', state, cookieState: state })),
    ).resolves.toBe('google_state');
  });

  it('Google error parameter is google_cancelled', async () => {
    await expect(reasonOf(service.complete({ error: 'access_denied' }))).resolves.toBe(
      'google_cancelled',
    );
  });

  it('google-sign-in.AC6 — a provider failure is google_failed', async () => {
    provider.identity = new UpstreamError('google');
    const { state } = await service.start();

    await expect(
      reasonOf(service.complete({ code: 'c', state, cookieState: state })),
    ).resolves.toBe('google_failed');
  });
});

describe('complete — resolving the user (google-sign-in.UT01)', () => {
  it('google-sign-in.AC2, AC12 — creates a verified member without a password', async () => {
    await users.create({ email: 'o@example.test', passwordHash: 'h', displayName: 'O', role: 'owner' });

    await signIn({ sub: 'sub-new', email: 'new@example.test', emailVerified: true, name: '<b>New</b> Person' });

    const created = await users.findByGoogleSub('sub-new');
    expect(created).toMatchObject({
      email: 'new@example.test',
      role: 'member',
      displayName: 'New Person',
      emailVerifiedAt: clock.now(),
    });
    expect(created?.passwordHash).toBeUndefined();
    expect(starter.started.map((user) => user.id)).toEqual([created?.id]);
  });

  it('falls back to the email local part for the display name', async () => {
    await signIn({ sub: 'sub-x', email: 'jane.doe@example.test', emailVerified: true });

    expect((await users.findByGoogleSub('sub-x'))?.displayName).toBe('jane.doe');
  });

  it('google-sign-in.AC3 — links an existing password account and keeps its role', async () => {
    const existing = await users.create({
      email: 'linked@example.test',
      passwordHash: 'h',
      displayName: 'L',
      role: 'owner',
    });

    await signIn({ sub: 'sub-l', email: 'linked@example.test', emailVerified: true });

    await expect(users.findById(existing.id)).resolves.toMatchObject({
      googleSub: 'sub-l',
      role: 'owner',
      emailVerifiedAt: clock.now(),
    });
  });

  it('google-sign-in.AC4 — the linked subject wins over a changed email', async () => {
    const linked = await users.create({
      email: 'old@example.test',
      displayName: 'Old',
      googleSub: 'sub-k',
      emailVerifiedAt: new Date(),
    });

    await signIn({ sub: 'sub-k', email: 'renamed@example.test', emailVerified: true });

    expect(starter.started.map((user) => user.id)).toEqual([linked.id]);
  });

  it('google-sign-in.AC7 — an unverified email writes nothing', async () => {
    await expect(
      reasonOf(signIn({ sub: 'sub-u', email: 'u@example.test', emailVerified: false })),
    ).resolves.toBe('google_unverified');
    await expect(users.findByEmail('u@example.test')).resolves.toBeNull();
  });

  it('google-sign-in.AC8 — another subject on a linked email is google_conflict', async () => {
    await users.create({ email: 'c@example.test', displayName: 'C', googleSub: 'sub-a', emailVerifiedAt: new Date() });

    await expect(
      reasonOf(signIn({ sub: 'sub-b', email: 'c@example.test', emailVerified: true })),
    ).resolves.toBe('google_conflict');
    expect((await users.findByEmail('c@example.test'))?.googleSub).toBe('sub-a');
  });
});
