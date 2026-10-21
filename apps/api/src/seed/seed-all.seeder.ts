/**
 * The `seed:all` orchestrator (`section-engine.T06`): runs every development seeder in order —
 * the account, its portfolio, its sections, and later identity and design — stopping at the
 * first failure. Each step is idempotent, so the whole run is.
 */
import type { ISeeder, SeedOutcome } from './seeder.interface.js';

/** One named step, so the script can log each outcome. */
export interface SeedStep {
  readonly name: string;
  readonly seeder: ISeeder;
}

/** What a full run did, step by step. */
export type SeedReport = readonly { readonly name: string; readonly outcome: SeedOutcome }[];

export class SeedAll {
  constructor(private readonly steps: readonly SeedStep[]) {}

  async run(): Promise<SeedReport> {
    const report: { name: string; outcome: SeedOutcome }[] = [];
    for (const { name, seeder } of this.steps) {
      report.push({ name, outcome: await seeder.run() });
    }
    return report;
  }
}
