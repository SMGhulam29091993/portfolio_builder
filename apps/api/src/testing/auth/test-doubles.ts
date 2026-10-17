/**
 * Fast, deterministic doubles of the `auth` module's hashing, randomness and clock ports, for
 * service tests (`constitution.md` → Per-layer convention).
 *
 * Each passes the same contract suite as the real adapter (`modules/auth/adapters/*.contract.spec.ts`),
 * so a service test that uses one proves what production would do — without argon2's tens of
 * milliseconds per call or real randomness. The hashers also count calls, which is how
 * `owner-auth.UT02` proves verification work happens for an unknown email.
 */
import type {
  IClock,
  IOtpHasher,
  IPasswordHasher,
  ISecureRandom,
} from '../../modules/auth/index.js';

/**
 * A reversible stand-in for a salted hash: `<prefix>:<salt>:<base64url(value)>`. The
 * per-instance counter plays the salt, so two hashes of one value differ, as with the real
 * hashers; the encoding keeps the plain value out of the hash, as a real hash would.
 */
class SaltedFake {
  private salt = 0;

  constructor(private readonly prefix: string) {}

  hash(value: string): string {
    this.salt += 1;
    return `${this.prefix}:${String(this.salt)}:${Buffer.from(value, 'utf8').toString('base64url')}`;
  }

  /** The value inside a hash, or `undefined` when it is not one of this fake's hashes. */
  unwrap(hashed: string): string | undefined {
    const [prefix, salt, encoded, ...rest] = hashed.split(':');
    if (prefix !== this.prefix || salt === undefined || encoded === undefined || rest.length > 0) {
      return undefined;
    }
    return Buffer.from(encoded, 'base64url').toString('utf8');
  }
}

/** Fake of `Argon2PasswordHasher`. */
export class FakePasswordHasher implements IPasswordHasher {
  private readonly fake = new SaltedFake('fake-argon2id');
  /** Number of `verify` calls so far. */
  verifyCalls = 0;

  hash(password: string): Promise<string> {
    return Promise.resolve(this.fake.hash(password));
  }

  verify(hash: string, password: string): Promise<boolean> {
    this.verifyCalls += 1;
    const inner = this.fake.unwrap(hash);
    if (inner === undefined) return Promise.reject(new Error('not a FakePasswordHasher hash'));
    return Promise.resolve(inner === password);
  }
}

/** Fake of `BcryptOtpHasher`. */
export class FakeOtpHasher implements IOtpHasher {
  private readonly fake = new SaltedFake('fake-bcrypt');
  /** Number of `compare` calls so far. */
  compareCalls = 0;

  hash(value: string): Promise<string> {
    return Promise.resolve(this.fake.hash(value));
  }

  compare(value: string, hashed: string): Promise<boolean> {
    this.compareCalls += 1;
    return Promise.resolve(this.fake.unwrap(hashed) === value);
  }
}

/** A clock that only moves when the test moves it. */
export class ManualClock implements IClock {
  private currentMs: number;

  /** @param start - The initial time; defaults to a fixed instant so runs are identical. */
  constructor(start: Date = new Date('2026-01-01T09:00:00.000Z')) {
    this.currentMs = start.getTime();
  }

  now(): Date {
    return new Date(this.currentMs);
  }

  /** Moves the clock forward by `ms`. */
  advance(ms: number): void {
    this.currentMs += ms;
  }

  /** Sets the clock to `at`. */
  set(at: Date): void {
    this.currentMs = at.getTime();
  }
}

/**
 * Deterministic "randomness": every value is derived from a counter, so each call differs from
 * the last, the n-th value is the same on every run, and lengths match the real adapter's.
 */
export class SequenceSecureRandom implements ISecureRandom {
  private counter = 0;

  base64url(byteLength: number): string {
    return this.nextBytes(byteLength).toString('base64url');
  }

  hex(byteLength: number): string {
    return this.nextBytes(byteLength).toString('hex');
  }

  numericCode(length: number): string {
    this.counter += 1;
    return String(this.counter % 10 ** length).padStart(length, '0');
  }

  /** `byteLength` bytes: the counter, big-endian, at the end of a zero buffer. */
  private nextBytes(byteLength: number): Buffer {
    this.counter += 1;
    const bytes = Buffer.alloc(byteLength);
    let remaining = this.counter;
    for (let index = byteLength - 1; index >= 0 && remaining > 0; index -= 1) {
      bytes[index] = remaining % 256;
      remaining = Math.floor(remaining / 256);
    }
    return bytes;
  }
}
