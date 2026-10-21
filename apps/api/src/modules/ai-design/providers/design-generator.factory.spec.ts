/**
 * `DesignGeneratorFactory` across the environment table (`ai-design-studio.T02`; UT01, UT02;
 * AC11, AC12) — the dev-bypass guard tested in both directions (`constitution.md` → Testing
 * Discipline): the stub activates only when nothing is configured outside production, and never
 * when a provider is named or in production.
 */
import { describe, expect, it } from 'vitest';

import { EnvValidationError, loadEnv, type Env } from '../../../config/env.js';
import {
  DesignGeneratorFactory,
  type DesignGeneratorAdapter,
  type DesignGeneratorRegistrations,
  type NetworkProviderId,
} from './design-generator.factory.js';
import { STUB_MODEL, StubDesignGenerator } from './stub.design-generator.js';

const BASE = {
  PORT: '4000',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
  REDIS_URL: 'redis://127.0.0.1:6379/0',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  WEB_ORIGIN: 'http://localhost:3000',
};
const GEMINI = { AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'gemini-key', AI_MODEL: 'gemini-model' };
const OPENROUTER = { AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'openrouter-key', AI_MODEL: 'router-model' };
const OLLAMA = { AI_PROVIDER: 'ollama', OLLAMA_BASE_URL: 'http://127.0.0.1:11434', AI_MODEL: 'local-model' };

function env(extra: Readonly<Record<string, string | undefined>>): Env {
  return loadEnv({ ...BASE, ...extra });
}

/** A test adapter that remembers the settings it was built from. */
class FakeAdapter implements DesignGeneratorAdapter {
  constructor(
    readonly providerId: NetworkProviderId,
    readonly settings: Env,
  ) {}

  generate() {
    return Promise.resolve({ text: '{}' });
  }

  check() {
    return Promise.resolve({ reachable: true });
  }
}

const ALL: DesignGeneratorRegistrations = {
  gemini: (settings) => new FakeAdapter('gemini', settings),
  openrouter: (settings) => new FakeAdapter('openrouter', settings),
  ollama: (settings) => new FakeAdapter('ollama', settings),
};

function factory(registrations: DesignGeneratorRegistrations = ALL) {
  return new DesignGeneratorFactory(registrations, { create: () => new StubDesignGenerator(), model: STUB_MODEL });
}

/** The variable names a refusal carries, or a failure when it did not refuse. */
function refusal(run: () => unknown): readonly string[] {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(EnvValidationError);
    return (error as EnvValidationError).variables;
  }
  throw new Error('expected the factory to refuse');
}

describe('DesignGeneratorFactory', () => {
  describe('ai-design-studio.UT01 / AC11 — outside production', () => {
    it.each(['development', 'test'])('%s with AI_PROVIDER unset or blank is the stub, with its fixture name', (mode) => {
      for (const provider of [{}, { AI_PROVIDER: '' }]) {
        const active = factory().create(env({ NODE_ENV: mode, ...provider }));
        expect(active.generator).toBeInstanceOf(StubDesignGenerator);
        expect(active.generator.providerId).toBe('stub');
        expect(active.health).toBe(active.generator);
        expect(active.model).toBe(STUB_MODEL);
      }
    });

    it('AI_PROVIDER=stub is the stub', () => {
      expect(factory().create(env({ AI_PROVIDER: 'stub' })).generator).toBeInstanceOf(StubDesignGenerator);
    });

    it.each([
      ['gemini', GEMINI],
      ['openrouter', OPENROUTER],
      ['ollama', OLLAMA],
    ] as const)('%s with its settings is that adapter, built from them, with AI_MODEL', (provider, settings) => {
      const active = factory().create(env(settings));
      expect(active.generator).toBeInstanceOf(FakeAdapter);
      expect(active.generator.providerId).toBe(provider);
      expect((active.generator as FakeAdapter).settings).toMatchObject(settings);
      expect(active.model).toBe(settings.AI_MODEL);
    });
  });

  describe('ai-design-studio.UT02 / AC12 — a named provider is never the stub', () => {
    it('non-production gemini with its key is the Gemini adapter', () => {
      const active = factory().create(env({ NODE_ENV: 'development', ...GEMINI }));
      expect(active.generator.providerId).toBe('gemini');
      expect(active.generator).not.toBeInstanceOf(StubDesignGenerator);
    });

    it.each([
      [GEMINI, 'GEMINI_API_KEY'],
      [GEMINI, 'AI_MODEL'],
      [OPENROUTER, 'OPENROUTER_API_KEY'],
      [OPENROUTER, 'AI_MODEL'],
      [OLLAMA, 'OLLAMA_BASE_URL'],
      [OLLAMA, 'AI_MODEL'],
    ] as const)('outside production, %o without %s refuses naming it, not the stub', (settings, unset) => {
      expect(refusal(() => factory().create(env({ ...settings, [unset]: '' })))).toEqual([unset]);
    });

    it('names every missing setting, in order', () => {
      expect(refusal(() => factory().create(env({ AI_PROVIDER: 'gemini' })))).toEqual(['GEMINI_API_KEY', 'AI_MODEL']);
    });

    it('a provider this build does not register refuses naming AI_PROVIDER', () => {
      expect(refusal(() => factory({}).create(env(GEMINI)))).toEqual(['AI_PROVIDER']);
    });
  });

  describe('ai-design-studio.UT01 / AC12 — production', () => {
    const production = (extra: Readonly<Record<string, string | undefined>>) => env({ NODE_ENV: 'production', ...extra });

    it.each([
      ['unset', {}],
      ['blank', { AI_PROVIDER: '' }],
      ['stub', { AI_PROVIDER: 'stub' }],
      ['ollama, even with its settings', OLLAMA],
    ])('AI_PROVIDER %s refuses naming AI_PROVIDER', (_row, extra) => {
      expect(refusal(() => factory().create(production(extra)))).toEqual(['AI_PROVIDER']);
    });

    it.each([
      [GEMINI, 'GEMINI_API_KEY'],
      [GEMINI, 'AI_MODEL'],
      [OPENROUTER, 'OPENROUTER_API_KEY'],
      [OPENROUTER, 'AI_MODEL'],
    ] as const)('%o without %s refuses naming it', (settings, unset) => {
      expect(refusal(() => factory().create(production({ ...settings, [unset]: '' })))).toEqual([unset]);
    });

    it.each([
      ['gemini', GEMINI],
      ['openrouter', OPENROUTER],
    ] as const)('%s with its settings is that adapter, never the stub', (provider, settings) => {
      const active = factory().create(production(settings));
      expect(active.generator.providerId).toBe(provider);
      expect(active.generator).not.toBeInstanceOf(StubDesignGenerator);
    });

    it('never builds the stub at all', () => {
      let stubs = 0;
      const counting = new DesignGeneratorFactory(ALL, {
        create: () => {
          stubs += 1;
          return new StubDesignGenerator();
        },
        model: STUB_MODEL,
      });
      for (const extra of [{}, { AI_PROVIDER: 'stub' }, OLLAMA, GEMINI]) {
        try {
          counting.create(production(extra));
        } catch {
          // Refusals are the point of the other rows; here only the count matters.
        }
      }
      expect(stubs).toBe(0);
    });

    it('a refusal names variables only, never a value', () => {
      const error = (() => {
        try {
          factory().create(production({ ...GEMINI, AI_MODEL: '' }));
        } catch (caught) {
          return caught as Error;
        }
        throw new Error('expected a refusal');
      })();
      expect(error.message).toContain('AI_MODEL');
      expect(error.message).not.toContain(GEMINI.GEMINI_API_KEY);
    });
  });
});
