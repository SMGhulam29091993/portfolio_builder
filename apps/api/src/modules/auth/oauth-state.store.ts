/**
 * The Google sign-in flow's state in Redis (`google-sign-in.T01`; ADR-0008 — Redis for the
 * `auth` module only; spec → Flow).
 *
 * `auth:google-state:<state>` → JSON `{ codeVerifier, nonce }` with a 10-minute TTL. `take` is
 * one `GETDEL`, so two callbacks carrying the same `state` cannot both get the verifier: the
 * second finds nothing (`google-sign-in.AC5`, replay).
 *
 * Every command runs through `whileRedisAvailable`, so an unreachable server is a
 * `ServiceUnavailableError`, never a driver error.
 */
import { z } from 'zod';

import { whileRedisAvailable } from '../../core/redis/redis-availability.js';
import type { IRedisClientProvider } from '../../core/redis/redis-client-provider.interface.js';
import type { IOAuthStateStore } from './auth.interface.js';
import type { OAuthState } from './auth.types.js';

/** Key prefix of every stored state. */
const STATE_KEY_PREFIX = 'auth:google-state:';

/** What a stored value must look like; anything else reads as "no state". */
const storedStateSchema = z.object({ codeVerifier: z.string().min(1), nonce: z.string().min(1) });

export interface RedisOAuthStateStoreOptions {
  /** Lifetime of a state in whole seconds (10 minutes). */
  readonly ttlSec: number;
}

export class RedisOAuthStateStore implements IOAuthStateStore {
  constructor(
    private readonly redis: IRedisClientProvider,
    private readonly options: RedisOAuthStateStoreOptions,
  ) {}

  async put(state: string, value: OAuthState): Promise<void> {
    await whileRedisAvailable(() =>
      this.redis.getClient().set(stateKey(state), JSON.stringify(value), {
        expiration: { type: 'EX', value: this.options.ttlSec },
      }),
    );
  }

  async take(state: string): Promise<OAuthState | null> {
    const raw = await whileRedisAvailable(() => this.redis.getClient().getDel(stateKey(state)));
    if (raw === null) return null;
    const parsed = storedStateSchema.safeParse(safeJson(raw));
    return parsed.success ? parsed.data : null;
  }
}

function stateKey(state: string): string {
  return `${STATE_KEY_PREFIX}${state}`;
}

/** `JSON.parse` that answers `undefined` instead of throwing on a corrupt value. */
function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}
