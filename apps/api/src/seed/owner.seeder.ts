/**
 * Creates one local account from `OWNER_EMAIL` / `OWNER_PASSWORD`, for development and tests only
 * (`owner-auth.T09`; AC13, AC14, AC23). Accounts in production come only from registration and
 * Google sign-in (ADR-0010), so this seeder refuses to run there.
 *
 * Idempotent by email: when the account exists, nothing is hashed and the stored password
 * survives a changed `OWNER_PASSWORD`. The account is created verified, and as the platform
 * owner while no owner exists — a member otherwise; an existing unverified account is marked
 * verified (`account-registration.AC16`), since sign-in now refuses unverified accounts.
 */
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@portfolio/contracts';

import type { Env } from '../config/env.js';
import { ConflictError } from '../core/errors/index.js';
import type {
  IClock,
  IOwnerLookup,
  IPasswordHasher,
  IUserCreator,
  IUserReader,
  IUserRegistrar,
} from '../modules/auth/index.js';
import { DEV_OWNER } from './data/owner.js';
import { SeedConfigurationError, SeedRefusedError } from './seed.errors.js';
import type { ISeeder, SeedOutcome } from './seeder.interface.js';

/** The configuration the seeder reads — nothing else from `Env`. */
export type OwnerSeederEnv = Pick<Env, 'NODE_ENV' | 'OWNER_EMAIL' | 'OWNER_PASSWORD'>;

/** The error code `IUserCreator.create` throws when the email is taken. */
const USER_EXISTS = 'USER_EXISTS';

/** The error code `IUserCreator.create` throws when the owner slot is taken. */
const OWNER_EXISTS = 'OWNER_EXISTS';

export class OwnerSeeder implements ISeeder {
  constructor(
    private readonly users: IUserReader,
    private readonly creator: IUserCreator,
    private readonly hasher: IPasswordHasher,
    private readonly env: OwnerSeederEnv,
    private readonly registrar: IUserRegistrar,
    private readonly owners: IOwnerLookup,
    private readonly clock: IClock,
  ) {}

  async run(): Promise<SeedOutcome> {
    // First, before any configuration check, read or hash (`owner-auth.AC23`).
    if (this.env.NODE_ENV === 'production') {
      throw new SeedRefusedError(
        'The development seeder never runs with NODE_ENV=production; accounts there come from registration',
      );
    }

    const { email, password } = this.credentials();

    const existing = await this.users.findByEmail(email);
    if (existing) {
      if (existing.emailVerifiedAt) return 'unchanged';
      await this.registrar.markEmailVerified(existing.id, this.clock.now());
      return 'updated';
    }

    const role = (await this.owners.ownerExists()) ? 'member' : 'owner';
    try {
      await this.creator.create({
        email,
        passwordHash: await this.hasher.hash(password),
        displayName: DEV_OWNER.displayName,
        role,
        emailVerifiedAt: this.clock.now(),
      });
      return 'created';
    } catch (error) {
      // A concurrent run created it between the lookup and the insert: still idempotent.
      if (error instanceof ConflictError && error.code === USER_EXISTS) return 'unchanged';
      // Another account took the owner slot in between: become a member instead.
      if (error instanceof ConflictError && error.code === OWNER_EXISTS) {
        await this.creator.create({
          email,
          passwordHash: await this.hasher.hash(password),
          displayName: DEV_OWNER.displayName,
          emailVerifiedAt: this.clock.now(),
        });
        return 'created';
      }
      throw error;
    }
  }

  /**
   * The configured email and password, checked before anything touches the database.
   *
   * The password must also fit sign-in's limit (API01), or the account could never be signed
   * into. Lengths count UTF-16 code units, as the login schema does.
   *
   * @throws {SeedConfigurationError} Either variable is unset, or the password is out of range.
   */
  private credentials(): { email: string; password: string } {
    const { OWNER_EMAIL: email, OWNER_PASSWORD: password } = this.env;

    if (!email) throw new SeedConfigurationError('OWNER_EMAIL', 'is not set');
    if (!password) throw new SeedConfigurationError('OWNER_PASSWORD', 'is not set');
    if (password.length < PASSWORD_MIN_LENGTH) {
      throw new SeedConfigurationError(
        'OWNER_PASSWORD',
        `must be at least ${String(PASSWORD_MIN_LENGTH)} characters`,
      );
    }
    if (password.length > PASSWORD_MAX_LENGTH) {
      throw new SeedConfigurationError(
        'OWNER_PASSWORD',
        `must be at most ${String(PASSWORD_MAX_LENGTH)} characters`,
      );
    }

    return { email, password };
  }
}
