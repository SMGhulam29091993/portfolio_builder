/**
 * Service tests for `AuthService` — sign-in, refresh, sign-out and `me` (`owner-auth.UT01`–`UT03`,
 * `UT06`–`UT09`; `AC1`, `AC2`, `AC4`, `AC6`–`AC11`).
 *
 * Every port is a constructor-injected fake that passes the real implementation's contract suite
 * (`owner-auth.CT01`, `CT03`, `CT08`, `CT09`, `CT10`), and the `SessionAuthorizer` is the real one
 * on those fakes, so the `jti` rule exercised here is the production rule. Tokens come from the
 * real `JwtTokenIssuer` on a `ManualClock` — pure computation, no I/O — so expiry is real.
 * No datastore is touched.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sha256Hex } from '../../core/crypto/sha256.js';
import { UnauthenticatedError } from '../../core/errors/index.js';
import {
  FakePasswordHasher,
  InMemorySessionStore,
  InMemoryUserRepository,
  ManualClock,
  SequenceSecureRandom,
} from '../../testing/index.js';
import { JwtTokenIssuer } from './adapters/jwt-token-issuer.js';
import { SessionExpiredError } from './auth.errors.js';
import { AuthService } from './auth.service.js';
import type { SessionCookies, SignedInSession, User } from './auth.types.js';
import { SessionAuthorizer } from './session-authorizer.service.js';

const SECRET = 'test-secret-that-is-long-enough-for-hs256-0123456789';
const ACCESS_TTL_SEC = 15 * 60;
const LEEWAY_SEC = 30;
const SESSION_TTL_SEC = 7 * 24 * 60 * 60;
const PASSWORD = 'correct horse battery staple';

let clock: ManualClock;
let users: InMemoryUserRepository;
let sessions: InMemorySessionStore;
let hasher: FakePasswordHasher;
let issuer: JwtTokenIssuer;
let authorizer: SessionAuthorizer;
let service: AuthService;
let owner: User;

beforeEach(async () => {
  clock = new ManualClock();
  users = new InMemoryUserRepository(() => clock.now());
  sessions = new InMemorySessionStore({ ttlSec: SESSION_TTL_SEC }, () => clock.now().getTime());
  hasher = new FakePasswordHasher();
  issuer = new JwtTokenIssuer(
    { secret: SECRET, ttlSec: ACCESS_TTL_SEC, leewaySec: LEEWAY_SEC },
    clock,
  );
  authorizer = new SessionAuthorizer(issuer, sessions);
  service = new AuthService(
    users,
    sessions,
    authorizer,
    hasher,
    issuer,
    new SequenceSecureRandom(),
    clock,
  );

  owner = await users.create({
    email: 'owner@example.test',
    passwordHash: await hasher.hash(PASSWORD),
    displayName: 'Owner',
  });
  // Seeding is not part of any case under test.
  hasher.verifyCalls = 0;
});

/** The cookies a browser holds after `signedIn`. */
function cookiesOf(signedIn: SignedInSession): SessionCookies {
  return { ...signedIn.tokens };
}

/** Lets the access token expire, as it does after 15 idle minutes. */
function expireAccessToken(): void {
  clock.advance((ACCESS_TTL_SEC + LEEWAY_SEC + 1) * 1_000);
}

describe('AuthService.login', () => {
  it('owner-auth.UT01 — returns the user and a token set, and stores the session', async () => {
    const signedIn = await service.login({ email: owner.email, password: PASSWORD });

    expect(signedIn.user).toStrictEqual({
      id: owner.id,
      email: owner.email,
      displayName: owner.displayName,
      role: 'member',
    });
    // 256-bit refresh token, 128-bit jti, base64url without padding.
    expect(signedIn.tokens.refreshToken).toMatch(/^[\w-]{43}$/);
    expect(signedIn.tokens.jti).toMatch(/^[\w-]{22}$/);
    await expect(sessions.get(owner.id)).resolves.toStrictEqual({
      jti: signedIn.tokens.jti,
      refreshTokenHash: sha256Hex(signedIn.tokens.refreshToken),
      issuedAt: clock.now(),
    });
    await expect(issuer.verifyAccessToken(signedIn.tokens.accessToken)).resolves.toMatchObject({
      sub: owner.id,
      jti: signedIn.tokens.jti,
    });
  });

  it('owner-auth.UT01 — replaces the previous session', async () => {
    const first = await service.login({ email: owner.email, password: PASSWORD });

    const second = await service.login({ email: owner.email, password: PASSWORD });

    expect(second.tokens.jti).not.toBe(first.tokens.jti);
    await expect(sessions.get(owner.id)).resolves.toMatchObject({ jti: second.tokens.jti });
  });

  it('owner-auth.IT23 — matches the email case-insensitively', async () => {
    await expect(
      service.login({ email: 'OWNER@Example.TEST', password: PASSWORD }),
    ).resolves.toMatchObject({ user: { id: owner.id } });
  });

  it('owner-auth.UT02 — rejects an unknown email after the same password-verification work', async () => {
    const result = service.login({ email: 'nobody@example.test', password: PASSWORD });

    await expect(result).rejects.toBeInstanceOf(UnauthenticatedError);
    expect(hasher.verifyCalls).toBe(1);
  });

  it('owner-auth.UT03 — rejects a wrong password with the same error as an unknown email', async () => {
    const unknown = await service
      .login({ email: 'nobody@example.test', password: PASSWORD })
      .catch((error: unknown) => error);
    const wrong = await service
      .login({ email: owner.email, password: 'wrong password' })
      .catch((error: unknown) => error);

    expect(wrong).toBeInstanceOf(UnauthenticatedError);
    expect(wrong).toMatchObject({ code: 'UNAUTHENTICATED', status: 401 });
    expect((wrong as Error).message).toBe((unknown as Error).message);
    expect(hasher.verifyCalls).toBe(2);
    await expect(sessions.get(owner.id)).resolves.toBeNull();
  });

  it('hashes the decoy password once and reuses it for every unknown email', async () => {
    const hash = vi.spyOn(hasher, 'hash');

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(
        service.login({ email: 'nobody@example.test', password: PASSWORD }),
      ).rejects.toBeInstanceOf(UnauthenticatedError);
    }

    expect(hash).toHaveBeenCalledTimes(1);
    expect(hasher.verifyCalls).toBe(3);
  });

  it('retries the decoy hash after a failure instead of failing every later sign-in', async () => {
    vi.spyOn(hasher, 'hash').mockRejectedValueOnce(new Error('hasher unavailable'));

    await expect(
      service.login({ email: 'nobody@example.test', password: PASSWORD }),
    ).rejects.toThrow('hasher unavailable');
    await expect(
      service.login({ email: 'nobody@example.test', password: PASSWORD }),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});

describe('AuthService with SessionAuthorizer', () => {
  it('owner-auth.AC7 — a sign-in on browser B ends browser A, and B is authorised', async () => {
    const browserA = await service.login({ email: owner.email, password: PASSWORD });
    const browserB = await service.login({ email: owner.email, password: PASSWORD });

    await expect(authorizer.authorize(cookiesOf(browserA))).rejects.toBeInstanceOf(
      SessionExpiredError,
    );
    await expect(authorizer.authorize(cookiesOf(browserB))).resolves.toMatchObject({
      userId: owner.id,
    });
  });
});

describe('AuthService.refresh', () => {
  it('owner-auth.UT06 — rotates jti, access and refresh token with a compare-and-set on the old jti', async () => {
    const signedIn = await service.login({ email: owner.email, password: PASSWORD });
    const compareAndSet = vi.spyOn(sessions, 'compareAndSet');
    expireAccessToken();

    const refreshed = await service.refresh(cookiesOf(signedIn));

    expect(refreshed.user).toStrictEqual(signedIn.user);
    expect(refreshed.tokens.jti).not.toBe(signedIn.tokens.jti);
    expect(refreshed.tokens.accessToken).not.toBe(signedIn.tokens.accessToken);
    expect(refreshed.tokens.refreshToken).not.toBe(signedIn.tokens.refreshToken);
    expect(compareAndSet).toHaveBeenCalledExactlyOnceWith(owner.id, signedIn.tokens.jti, {
      jti: refreshed.tokens.jti,
      refreshTokenHash: sha256Hex(refreshed.tokens.refreshToken),
      issuedAt: clock.now(),
    });
    await expect(authorizer.authorize(cookiesOf(refreshed))).resolves.toMatchObject({
      userId: owner.id,
    });
  });

  it('owner-auth.AC8 — replaying the old cookies after a refresh is SESSION_EXPIRED', async () => {
    const signedIn = await service.login({ email: owner.email, password: PASSWORD });
    expireAccessToken();
    await service.refresh(cookiesOf(signedIn));

    await expect(service.refresh(cookiesOf(signedIn))).rejects.toBeInstanceOf(SessionExpiredError);
  });

  it('owner-auth.AC8 — a refresh restarts the 7-day session lifetime', async () => {
    const signedIn = await service.login({ email: owner.email, password: PASSWORD });
    clock.advance((SESSION_TTL_SEC - 60) * 1_000);
    const refreshed = await service.refresh(cookiesOf(signedIn));

    // Past 7 days since sign-in, but only a day since the refresh.
    clock.advance(24 * 60 * 60 * 1_000);

    await expect(sessions.get(owner.id)).resolves.toMatchObject({ jti: refreshed.tokens.jti });
  });

  it('owner-auth.UT07 — a wrong refresh token with a matching jti deletes the session', async () => {
    const signedIn = await service.login({ email: owner.email, password: PASSWORD });

    await expect(
      service.refresh({ ...cookiesOf(signedIn), refreshToken: 'forged-refresh-token' }),
    ).rejects.toBeInstanceOf(UnauthenticatedError);

    await expect(sessions.get(owner.id)).resolves.toBeNull();
    // `owner-auth.AC9`: the genuine cookies stop working too.
    await expect(service.refresh(cookiesOf(signedIn))).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it('owner-auth.AC9 — an absent refresh token with a matching jti deletes the session', async () => {
    const { tokens } = await service.login({ email: owner.email, password: PASSWORD });

    await expect(
      service.refresh({ accessToken: tokens.accessToken, jti: tokens.jti }),
    ).rejects.toBeInstanceOf(UnauthenticatedError);

    await expect(sessions.get(owner.id)).resolves.toBeNull();
  });

  it('owner-auth.UT08 — throws SESSION_EXPIRED and deletes nothing when compare-and-set loses', async () => {
    const signedIn = await service.login({ email: owner.email, password: PASSWORD });
    const stored = await sessions.get(owner.id);
    vi.spyOn(sessions, 'compareAndSet').mockResolvedValueOnce(false);
    const deleteIfJti = vi.spyOn(sessions, 'deleteIfJti');
    const remove = vi.spyOn(sessions, 'delete');

    await expect(service.refresh(cookiesOf(signedIn))).rejects.toBeInstanceOf(SessionExpiredError);

    expect(deleteIfJti).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    await expect(sessions.get(owner.id)).resolves.toEqual(stored);
  });

  it('owner-auth.AC10 — of two concurrent refreshes with the same cookies, exactly one succeeds', async () => {
    const signedIn = await service.login({ email: owner.email, password: PASSWORD });

    const results = await Promise.allSettled([
      service.refresh(cookiesOf(signedIn)),
      service.refresh(cookiesOf(signedIn)),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(SessionExpiredError);
    await expect(sessions.get(owner.id)).resolves.toMatchObject({
      jti: fulfilled[0]?.value.tokens.jti,
    });
  });

  it('owner-auth.AC6 — a jti mismatch is SESSION_EXPIRED and leaves the session in place', async () => {
    const signedIn = await service.login({ email: owner.email, password: PASSWORD });
    const stored = await sessions.get(owner.id);

    await expect(
      service.refresh({ ...cookiesOf(signedIn), jti: 'jti-from-another-browser' }),
    ).rejects.toBeInstanceOf(SessionExpiredError);

    await expect(sessions.get(owner.id)).resolves.toEqual(stored);
  });

  it('throws UNAUTHENTICATED without cookies', async () => {
    await expect(service.refresh({})).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it('throws UNAUTHENTICATED when the session names a user that no longer exists', async () => {
    const ghostId = '6a00000000000000000000ff';
    const refreshToken = 'refresh-token-of-a-removed-user';
    await sessions.replace(ghostId, {
      jti: 'jti-ghost',
      refreshTokenHash: sha256Hex(refreshToken),
      issuedAt: clock.now(),
    });
    const accessToken = await issuer.signAccessToken({ userId: ghostId, jti: 'jti-ghost' });

    await expect(
      service.refresh({ accessToken, jti: 'jti-ghost', refreshToken }),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});

describe('AuthService.logout', () => {
  it('owner-auth.UT09 — deletes the current session, even with an expired access token', async () => {
    const signedIn = await service.login({ email: owner.email, password: PASSWORD });
    expireAccessToken();

    await service.logout(cookiesOf(signedIn));

    await expect(sessions.get(owner.id)).resolves.toBeNull();
    // `owner-auth.AC11`: a later refresh with the old cookies is UNAUTHENTICATED.
    await expect(service.refresh(cookiesOf(signedIn))).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it('owner-auth.UT09 — a superseded browser cannot end the newer session', async () => {
    const browserA = await service.login({ email: owner.email, password: PASSWORD });
    const browserB = await service.login({ email: owner.email, password: PASSWORD });

    await expect(service.logout(cookiesOf(browserA))).resolves.toBeUndefined();

    await expect(sessions.get(owner.id)).resolves.toMatchObject({ jti: browserB.tokens.jti });
  });

  it('owner-auth.UT09 — succeeds with no cookies or a malformed token, deleting nothing', async () => {
    await service.login({ email: owner.email, password: PASSWORD });
    const stored = await sessions.get(owner.id);

    await expect(service.logout({})).resolves.toBeUndefined();
    await expect(service.logout({ accessToken: 'malformed', jti: 'x' })).resolves.toBeUndefined();

    await expect(sessions.get(owner.id)).resolves.toEqual(stored);
  });

  it('propagates a session-store failure instead of reporting a sign-out that did not happen', async () => {
    const signedIn = await service.login({ email: owner.email, password: PASSWORD });
    vi.spyOn(sessions, 'get').mockRejectedValueOnce(new Error('redis unreachable'));

    await expect(service.logout(cookiesOf(signedIn))).rejects.toThrow('redis unreachable');
  });
});

describe('AuthService.me', () => {
  it('owner-auth.AC4 — returns the user the guard authorised', async () => {
    await expect(service.me(owner.id)).resolves.toStrictEqual({
      id: owner.id,
      email: owner.email,
      displayName: owner.displayName,
      role: 'member',
    });
  });

  it('throws UNAUTHENTICATED for a user that no longer exists', async () => {
    await expect(service.me('6a00000000000000000000ff')).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });
});
