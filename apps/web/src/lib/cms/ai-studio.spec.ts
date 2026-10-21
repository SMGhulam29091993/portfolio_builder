/** `ai-design-studio.AC16`, `AC18` — the AI Studio's provider badge and allowance summary. */
import type { AiProviderInfo, GenerationAllowance } from '@portfolio/contracts';
import { describe, expect, it } from 'vitest';

import { allowanceSummary, providerBadge } from './ai-studio';

const format = (iso: string) => iso.slice(0, 10);
const allowance = (overrides: Partial<GenerationAllowance>): GenerationAllowance => ({
  unlimited: false,
  freeMonthly: 5,
  freeUsed: 0,
  creditCost: 1,
  balance: 0,
  resetsAt: '2026-11-01T00:00:00.000Z',
  ...overrides,
});
const info = (overrides: Partial<AiProviderInfo>): AiProviderInfo => ({
  provider: 'gemini',
  model: 'gemini-model',
  isStub: false,
  reachable: true,
  allowance: allowance({}),
  ...overrides,
});

describe('providerBadge', () => {
  it('ai-design-studio.E2E04 / AC16 — names the stub as "Stub (development)", else provider and model', () => {
    expect(providerBadge(info({ provider: 'stub', model: 'fixture', isStub: true }))).toBe('Stub (development)');
    expect(providerBadge(info({}))).toBe('Gemini · gemini-model');
    expect(providerBadge(info({ provider: 'openrouter', model: 'a/b' }))).toBe('OpenRouter · a/b');
    expect(providerBadge(info({ provider: 'ollama', model: 'llama' }))).toBe('Ollama · llama');
  });
});

describe('allowanceSummary', () => {
  it('ai-design-studio.AC18 — the owner is unlimited', () => {
    expect(allowanceSummary(allowance({ unlimited: true, balance: null }), format)).toEqual({ text: 'Unlimited generations.', canGenerate: true });
  });

  it('ai-design-studio.AC18 — free generations left, with the reset date', () => {
    expect(allowanceSummary(allowance({ freeUsed: 3 }), format)).toEqual({
      text: '2 free generations left this month (of 5); resets 2026-11-01.',
      canGenerate: true,
    });
    expect(allowanceSummary(allowance({ freeUsed: 4 }), format).text).toMatch(/^1 free generation left/);
  });

  it('ai-design-studio.AC18 — once used: the credit cost and the balance; refused when short', () => {
    expect(allowanceSummary(allowance({ freeUsed: 5, balance: 0 }), format)).toEqual({
      text: "This month's free generations are used; they reset 2026-11-01. The next one costs 1 credit; you have 0 credits.",
      canGenerate: false,
    });
    expect(allowanceSummary(allowance({ freeUsed: 5, balance: 3, creditCost: 2 }), format)).toMatchObject({ canGenerate: true });
  });
});
