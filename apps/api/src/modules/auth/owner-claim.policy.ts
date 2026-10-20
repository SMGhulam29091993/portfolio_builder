/**
 * `IOwnerClaimPolicy` — who becomes the platform owner (`account-registration` spec → Roles and
 * the owner claim; ADR-0010).
 *
 * The claim is open while no owner exists and `OWNER_REGISTRATION_SECRET` is configured. A
 * registration that carries a secret while it is open and matching becomes the owner; any
 * other registration that carries one is refused with one error for every reason, so the
 * response does not say whether an owner exists or which character was wrong. The secret is
 * compared in constant time and never logged or stored.
 *
 * The owner index (`one_owner`) remains the final word: two matching claims can both pass this
 * policy, and the database then admits exactly one (`account-registration.AC6`).
 */
import { constantTimeEquals } from '../../core/crypto/constant-time.js';
import { OwnerClaimRefusedError } from './auth.errors.js';
import type { IOwnerClaimPolicy, IOwnerLookup } from './auth.interface.js';
import type { UserRole } from './auth.types.js';

/** What the policy is configured with — the container reads it from `Env`. */
export interface OwnerClaimOptions {
  /** `OWNER_REGISTRATION_SECRET`; `undefined` keeps the claim closed. */
  readonly secret: string | undefined;
}

export class OwnerClaimPolicy implements IOwnerClaimPolicy {
  constructor(
    private readonly owners: IOwnerLookup,
    private readonly options: OwnerClaimOptions,
  ) {}

  async isOpen(): Promise<boolean> {
    if (this.options.secret === undefined) return false;
    return !(await this.owners.ownerExists());
  }

  async decide(ownerSecret: string | undefined): Promise<UserRole> {
    if (ownerSecret === undefined) return 'member';
    const { secret } = this.options;
    // Compared first, before the database is asked, so a wrong value costs the same with or
    // without an owner. The comparison itself always runs, even when no secret is set.
    const matches = constantTimeEquals(ownerSecret, secret ?? '') && secret !== undefined;
    if (!matches || (await this.owners.ownerExists())) throw new OwnerClaimRefusedError();
    return 'owner';
  }
}
