/**
 * `DefaultAiPricing` — the seeded AI prices (ADR-0012 → Owner answers, 2026-10-21) until
 * `platform-admin` makes them owner-edited settings and replaces this in the container. The
 * values come from `container.ts`, not literals here.
 */
import type { IAiPricing } from '../ai-design.interface.js';

export class DefaultAiPricing implements IAiPricing {
  constructor(private readonly prices: { readonly freeMonthly: number; readonly creditCost: number }) {}

  current(): Promise<{ readonly freeMonthly: number; readonly creditCost: number }> {
    return Promise.resolve(this.prices);
  }
}
