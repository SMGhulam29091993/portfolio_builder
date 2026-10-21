/**
 * `DesignGeneratorFactory` — the one place the AI environment table is implemented
 * (`ai-design-studio` → Provider contract; ADR-0003; AC11, AC12):
 *
 * | Environment    | `AI_PROVIDER`                              | Result                    |
 * |----------------|--------------------------------------------|---------------------------|
 * | not production | unset or `stub`                            | the stub                  |
 * | not production | `gemini` / `openrouter` / `ollama`         | that adapter              |
 * | production     | unset, `stub` or `ollama`                  | throws naming the variable |
 * | any            | a provider without its key, URL or `AI_MODEL` | throws naming them     |
 *
 * Once a provider is named, the stub is never the answer: a missing setting or an adapter this
 * build does not register fails startup instead of quietly falling back (AC12; ADR-0003: no
 * automatic fallback). Adapters are registrations built by `container.ts`, so adding one is a
 * registration line there, not an edit here (Open / Closed).
 */
import { EnvValidationError, type Env } from '../../../config/env.js';
import type { ActiveDesignGenerator, IDesignGenerator, IProviderHealth } from '../ai-design.interface.js';

/** A provider that calls out over the network; the stub is handled apart. */
export type NetworkProviderId = 'gemini' | 'openrouter' | 'ollama';

/** What each provider needs set, in the order an error names them. */
const REQUIRED_SETTINGS = {
  gemini: ['GEMINI_API_KEY', 'AI_MODEL'],
  openrouter: ['OPENROUTER_API_KEY', 'AI_MODEL'],
  ollama: ['OLLAMA_BASE_URL', 'AI_MODEL'],
} as const satisfies Record<NetworkProviderId, readonly (keyof Env)[]>;

/** Providers refused in production whatever else is set (ADR-0003: Ollama is for development). */
const DEVELOPMENT_ONLY: ReadonlySet<string> = new Set(['stub', 'ollama']);

/** A generator that is also its own health check — every adapter is both. */
export type DesignGeneratorAdapter = IDesignGenerator & IProviderHealth;

/** The configuration an adapter is built from, its required settings known to be set. */
export type ProviderSettings<P extends NetworkProviderId> = Env & {
  readonly [K in (typeof REQUIRED_SETTINGS)[P][number]]-?: NonNullable<Env[K]>;
};

/** How the container supplies the stub: a builder and the model name its proposals record. */
export interface StubRegistration {
  readonly create: () => DesignGeneratorAdapter;
  readonly model: string;
}

/** Adapter builders by provider id; `container.ts` supplies them. */
export type DesignGeneratorRegistrations = {
  readonly [P in NetworkProviderId]?: (settings: ProviderSettings<P>) => DesignGeneratorAdapter;
};

export class DesignGeneratorFactory {
  /**
   * @param registrations - The adapters this build can construct.
   * @param stubRegistration - The stub; built only where the table allows it.
   */
  constructor(
    private readonly registrations: DesignGeneratorRegistrations,
    private readonly stubRegistration: StubRegistration,
  ) {}

  /**
   * The generator for this environment.
   *
   * @throws {EnvValidationError} A row of the table that must fail startup, naming the variables.
   */
  create(env: Env): ActiveDesignGenerator {
    // The dev-bypass guard, in the form `constitution.md` → Security Posture fixes.
    if (env.NODE_ENV !== 'production' && !env.AI_PROVIDER) return this.stub();

    const provider = env.AI_PROVIDER;
    if (provider === undefined || (env.NODE_ENV === 'production' && DEVELOPMENT_ONLY.has(provider))) {
      throw new EnvValidationError(['AI_PROVIDER']);
    }
    if (provider === 'stub') return this.stub();

    const missing = REQUIRED_SETTINGS[provider].filter((name) => env[name] === undefined);
    if (missing.length > 0) throw new EnvValidationError(missing);

    const adapter = this.build(provider, env);
    // Sound: `AI_MODEL` is in every network provider's required settings, checked just above.
    return { generator: adapter, health: adapter, model: env.AI_MODEL ?? '' };
  }

  private build(provider: NetworkProviderId, env: Env): DesignGeneratorAdapter {
    const register = this.registrations[provider] as ((settings: Env) => DesignGeneratorAdapter) | undefined;
    // Named but not built into this version: refuse rather than answer with the stub (AC12).
    if (register === undefined) throw new EnvValidationError(['AI_PROVIDER']);
    // Sound: `create` checked every required setting of `provider` before calling this.
    return register(env);
  }

  private stub(): ActiveDesignGenerator {
    const stub = this.stubRegistration.create();
    return { generator: stub, health: stub, model: this.stubRegistration.model };
  }
}
