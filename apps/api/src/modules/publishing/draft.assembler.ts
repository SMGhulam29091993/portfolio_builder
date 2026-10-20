/**
 * `IDraftAssembler` (`publish-pipeline.T03`): asks every contributor for its part, builds the
 * content and hashes it. Contributors run in parallel; the result does not depend on their order
 * (AC10). Exactly one contributor per part is required — checked when the container builds it,
 * so a missing or doubled contributor fails startup rather than a publish.
 */
import type { AnyDraftContributor, ICanonicalHasher, IDraftAssembler, ISnapshotBuilder } from './publishing.interface.js';
import type { AssembledDraft, DraftPartKey, DraftParts, DraftScope } from './publishing.types.js';

const PART_KEYS: readonly DraftPartKey[] = ['sections', 'identity', 'design'];

export class DraftAssembler implements IDraftAssembler {
  constructor(
    private readonly contributors: readonly AnyDraftContributor[],
    private readonly builder: ISnapshotBuilder,
    private readonly hasher: ICanonicalHasher,
  ) {
    for (const key of PART_KEYS) {
      const count = contributors.filter((contributor) => contributor.key === key).length;
      if (count !== 1) throw new Error(`Exactly one "${key}" draft contributor is required; found ${String(count)}`);
    }
  }

  async assemble(scope: DraftScope): Promise<AssembledDraft> {
    const entries = await Promise.all(
      this.contributors.map(async (contributor) => [contributor.key, await contributor.collect(scope)] as const),
    );
    const parts = Object.fromEntries(entries) as unknown as DraftParts;
    const content = await this.builder.build(scope.portfolioId, parts);
    return { content, contentHash: this.hasher.hash(content) };
  }
}
