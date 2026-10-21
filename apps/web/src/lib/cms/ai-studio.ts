/**
 * What the AI Studio says about the provider and the allowance (`ai-design-studio.AC16`, `AC18`).
 * Pure, so the rules are unit-tested; the screen only renders the result.
 */
import type { AiProviderInfo, GenerationAllowance, ProposalScope } from '@portfolio/contracts';

/** How each provider is named on screen. */
const PROVIDER_NAMES: Readonly<Record<AiProviderInfo['provider'], string>> = {
  gemini: 'Gemini',
  openrouter: 'OpenRouter',
  ollama: 'Ollama',
  stub: 'Stub (development)',
};

/** The badge text: "Stub (development)", or the provider and its model (AC16). */
export function providerBadge(info: AiProviderInfo): string {
  return info.isStub ? PROVIDER_NAMES.stub : `${PROVIDER_NAMES[info.provider]} · ${info.model}`;
}

export const SCOPE_OPTIONS: readonly { value: ProposalScope; label: string }[] = [
  { value: 'both', label: 'Theme and layout' },
  { value: 'theme', label: 'Theme only (colours, fonts, effects)' },
  { value: 'layout', label: 'Layout only (section variants)' },
];

export interface AllowanceSummary {
  /** One sentence about this month's generations and, past them, their cost. */
  readonly text: string;
  /** `false` when the next generation would be refused for credits (402). */
  readonly canGenerate: boolean;
}

const plural = (count: number, word: string) => `${String(count)} ${word}${count === 1 ? '' : 's'}`;

/**
 * The allowance before anything is submitted (AC18): the free generations left, or — once they
 * are used — the next one's credit cost and the balance.
 */
export function allowanceSummary(allowance: GenerationAllowance, format: (iso: string) => string): AllowanceSummary {
  if (allowance.unlimited) return { text: 'Unlimited generations.', canGenerate: true };
  const left = Math.max(0, allowance.freeMonthly - allowance.freeUsed);
  if (left > 0) {
    return {
      text: `${plural(left, 'free generation')} left this month (of ${String(allowance.freeMonthly)}); resets ${format(allowance.resetsAt)}.`,
      canGenerate: true,
    };
  }
  const balance = allowance.balance ?? 0;
  return {
    text: `This month's free generations are used; they reset ${format(allowance.resetsAt)}. The next one costs ${plural(allowance.creditCost, 'credit')}; you have ${plural(balance, 'credit')}.`,
    canGenerate: balance >= allowance.creditCost,
  };
}

/** Where "Buy credits" leads (AC18); the page arrives with `credits-billing`. */
export const BUY_CREDITS_HREF = '/cms/credits';
