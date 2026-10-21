/**
 * `InterruptedProposalRecovery` (`ai-design-studio.T04`; AC10): the startup hook that fails every
 * proposal a restart left `pending`, so a new generation can be requested. It runs after the
 * container is built and before the server listens (`constitution.md` → Infrastructure).
 *
 * It depends on the service's recovery role rather than the repository (a deviation from the
 * plan's table, recorded there): an interrupted proposal also gives back its charge (AC17).
 */
import type { IStartupHook } from '../../core/lifecycle/startup-hook.interface.js';
import type { IInterruptedWorkRecovery } from './ai-design.interface.js';

export class InterruptedProposalRecovery implements IStartupHook {
  readonly name = 'interrupted design proposals';

  constructor(private readonly recovery: IInterruptedWorkRecovery) {}

  async run(): Promise<void> {
    await this.recovery.recoverInterrupted();
  }
}
