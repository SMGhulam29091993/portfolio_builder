/**
 * In-memory fakes of the `auth` module's Redis stores, for service tests
 * (`constitution.md` → Per-layer convention: services get constructor-injected fakes).
 *
 * Each fake passes the same contract suite as its Redis implementation
 * (`modules/auth/session-store.contract.spec.ts`, `otp-reference-store.contract.spec.ts`), so a
 * service test using one proves what the real store would do. TTLs follow an injected clock,
 * so a test advances time instead of sleeping.
 */
import type { AuthSession, IOtpReferenceStore, ISessionStore } from '../../modules/auth/index.js';

/** Milliseconds since the epoch. Defaults to `Date.now`; tests pass a controllable one. */
export type Clock = () => number;

/** A stored value and the instant it stops existing. */
interface Expiring<T> {
  readonly value: T;
  readonly expiresAtMs: number;
}

/** Shared TTL bookkeeping: a value past its expiry reads as absent and is dropped. */
class ExpiringMap<T> {
  private readonly entries = new Map<string, Expiring<T>>();

  constructor(
    private readonly ttlSec: number,
    private readonly now: Clock,
  ) {}

  get(key: string): T | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (this.now() >= entry.expiresAtMs) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.entries.set(key, { value, expiresAtMs: this.now() + this.ttlSec * 1_000 });
  }

  delete(key: string): boolean {
    const existed = this.get(key) !== null;
    this.entries.delete(key);
    return existed;
  }
}

/** Fake of `RedisSessionStore`. Single-threaded JavaScript makes every method atomic. */
export class InMemorySessionStore implements ISessionStore {
  private readonly sessions: ExpiringMap<AuthSession>;

  constructor(options: { readonly ttlSec: number }, now: Clock = Date.now) {
    this.sessions = new ExpiringMap(options.ttlSec, now);
  }

  get(userId: string): Promise<AuthSession | null> {
    return Promise.resolve(this.sessions.get(userId));
  }

  replace(userId: string, session: AuthSession): Promise<void> {
    this.sessions.set(userId, session);
    return Promise.resolve();
  }

  compareAndSet(userId: string, expectedJti: string, next: AuthSession): Promise<boolean> {
    if (this.sessions.get(userId)?.jti !== expectedJti) return Promise.resolve(false);
    this.sessions.set(userId, next);
    return Promise.resolve(true);
  }

  deleteIfJti(userId: string, expectedJti: string): Promise<boolean> {
    if (this.sessions.get(userId)?.jti !== expectedJti) return Promise.resolve(false);
    return Promise.resolve(this.sessions.delete(userId));
  }

  delete(userId: string): Promise<void> {
    this.sessions.delete(userId);
    return Promise.resolve();
  }
}

/** Fake of `RedisOtpReferenceStore`. */
export class InMemoryOtpReferenceStore implements IOtpReferenceStore {
  private readonly references: ExpiringMap<string>;

  constructor(options: { readonly ttlSec: number }, now: Clock = Date.now) {
    this.references = new ExpiringMap(options.ttlSec, now);
  }

  put(reference: string, identifier: string): Promise<void> {
    this.references.set(reference, identifier);
    return Promise.resolve();
  }

  resolve(reference: string): Promise<string | null> {
    return Promise.resolve(this.references.get(reference));
  }

  delete(reference: string): Promise<void> {
    this.references.delete(reference);
    return Promise.resolve();
  }
}
