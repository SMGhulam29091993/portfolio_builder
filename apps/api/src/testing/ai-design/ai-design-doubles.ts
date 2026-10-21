/**
 * Test doubles for the `ai-design` service and allowance tests (`ai-design-studio.T04`). Each is
 * the smallest honest implementation of its port: the scripted generator answers from a queue,
 * the design store checks revisions and validates with the real `validateDesign`.
 */
import { DEFAULT_DESIGN, validateDesign, type DesignSpec } from '@portfolio/design-tokens';

import type { IBackgroundRunner } from '../../core/background/index.js';
import { ConflictError, UpstreamError, ValidationError } from '../../core/errors/index.js';
import type {
  ActiveDesignGenerator,
  GenerationRequest,
  GenerationResult,
  IDesignGenerator,
  IGenerationWallet,
  IProviderHealth,
  ISectionTypeLister,
  IUserRoleReader,
  UserRole,
} from '../../modules/ai-design/index.js';
import type { CmsDesign, IDesignReader, IDesignValidator, IDesignWriter } from '../../modules/design/index.js';

/** One scripted answer: text, or an error to throw. */
export type ScriptedAnswer = string | Error;

/** Answers each call with the next scripted answer and remembers every request it got. */
export class ScriptedDesignGenerator implements IDesignGenerator, IProviderHealth {
  readonly requests: GenerationRequest[] = [];
  reachable = true;

  constructor(
    private readonly answers: ScriptedAnswer[] = [],
    readonly providerId: IDesignGenerator['providerId'] = 'ollama',
  ) {}

  /** As an `ActiveDesignGenerator` with `model`. */
  active(model = 'scripted-model'): ActiveDesignGenerator {
    return { generator: this, health: this, model };
  }

  generate(request: GenerationRequest): Promise<GenerationResult> {
    this.requests.push(structuredClone(request));
    const answer = this.answers.shift() ?? new UpstreamError(this.providerId);
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve({ text: answer });
  }

  check(): Promise<{ reachable: boolean }> {
    return Promise.resolve({ reachable: this.reachable });
  }
}

/** Holds background tasks until `runAll`, so a test can look at the `pending` state first. */
export class ManualBackgroundRunner implements IBackgroundRunner {
  readonly labels: string[] = [];
  private tasks: (() => Promise<void>)[] = [];

  run(label: string, task: () => Promise<void>): void {
    this.labels.push(label);
    this.tasks.push(task);
  }

  async runAll(): Promise<void> {
    while (this.tasks.length > 0) {
      const batch = this.tasks;
      this.tasks = [];
      for (const task of batch) await task();
    }
  }
}

/** One portfolio's design: the default at revision 0 until written, like `DesignService`. */
export class InMemoryDesignStore implements IDesignReader, IDesignWriter {
  private readonly designs = new Map<string, { revision: number; design: DesignSpec }>();
  readonly writes: string[] = [];

  read(portfolioId: string): Promise<CmsDesign> {
    const stored = this.designs.get(portfolioId) ?? { revision: 0, design: DEFAULT_DESIGN };
    return Promise.resolve({ ...structuredClone(stored.design), revision: stored.revision });
  }

  apply(portfolioId: string, candidate: unknown, expectedRevision: number): Promise<CmsDesign> {
    const verdict = validateDesign(candidate);
    if (!verdict.ok) return Promise.reject(new ValidationError(verdict.issues));
    const currentRevision = this.designs.get(portfolioId)?.revision ?? 0;
    if (currentRevision !== expectedRevision) {
      return Promise.reject(new ConflictError('REVISION_CONFLICT', { currentRevision }));
    }
    this.designs.set(portfolioId, { revision: currentRevision + 1, design: verdict.design });
    this.writes.push(portfolioId);
    return this.read(portfolioId);
  }
}

/** The same visible sections for every portfolio. */
export class StaticSectionLister implements ISectionTypeLister {
  constructor(private readonly visible: readonly string[] = ['hero', 'about', 'work']) {}

  listVisible(): Promise<readonly string[]> {
    return Promise.resolve(this.visible);
  }
}

/** Roles by user id; anyone unlisted is unknown (`null`). */
export class MapRoleReader implements IUserRoleReader {
  constructor(private readonly roles: Readonly<Record<string, UserRole>>) {}

  roleOf(userId: string): Promise<UserRole | null> {
    return Promise.resolve(this.roles[userId] ?? null);
  }
}

/** Balances by user id; records every spend and refund. */
export class RecordingWallet implements IGenerationWallet {
  readonly spends: { userId: string; credits: number; reference: string }[] = [];
  readonly refunds: { userId: string; credits: number; reference: string }[] = [];
  /** Set to make the next spend fail even with enough credits (a lost race). */
  refuseNextSpend = false;

  constructor(private readonly balances: Record<string, number> = {}) {}

  balance(userId: string): Promise<number> {
    return Promise.resolve(this.balances[userId] ?? 0);
  }

  spend(userId: string, credits: number, reference: string): Promise<boolean> {
    const balance = this.balances[userId] ?? 0;
    if (this.refuseNextSpend || balance < credits) {
      this.refuseNextSpend = false;
      return Promise.resolve(false);
    }
    this.balances[userId] = balance - credits;
    this.spends.push({ userId, credits, reference });
    return Promise.resolve(true);
  }

  refund(userId: string, credits: number, reference: string): Promise<void> {
    this.balances[userId] = (this.balances[userId] ?? 0) + credits;
    this.refunds.push({ userId, credits, reference });
    return Promise.resolve();
  }
}

/** `IDesignValidator` over the real `validateDesign`, without `design`'s class. */
export class TokensDesignValidator implements IDesignValidator {
  validate(candidate: unknown): DesignSpec {
    const verdict = validateDesign(candidate);
    if (!verdict.ok) throw new ValidationError(verdict.issues);
    return verdict.design;
  }
}
