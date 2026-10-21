/**
 * `EmptyGenerationWallet` — no credits exist until `credits-billing` (ADR-0012) implements
 * `IGenerationWallet` and replaces this in the container. A member past the free allowance is
 * therefore refused with 402 `CREDITS_REQUIRED` (`ai-design-studio` spec → Status).
 */
import type { IGenerationWallet } from '../ai-design.interface.js';

export class EmptyGenerationWallet implements IGenerationWallet {
  balance(): Promise<number> {
    return Promise.resolve(0);
  }

  /** Never succeeds: there is nothing to spend. */
  spend(): Promise<boolean> {
    return Promise.resolve(false);
  }

  /** Nothing was ever spent, so there is nothing to give back. */
  refund(): Promise<void> {
    return Promise.resolve();
  }
}
