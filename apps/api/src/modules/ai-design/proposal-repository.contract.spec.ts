/**
 * `ai-design-studio.CT04` — shared contract suite for `IProposalRepository`, run against
 * `ProposalRepository` on a real `mongod` and against `InMemoryProposalRepository`, the fake the
 * service and the allowance are tested with (`constitution.md` → Liskov Substitution). Covers
 * AC1, AC7 / IT14 at the storage layer and AC17's count and refund flag. What only MongoDB has
 * (the strict schema) is in `proposal.repository.spec.ts`.
 */
import { Types } from 'mongoose';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { InMemoryProposalRepository, MongoTestHarness } from '../../testing/index.js';
import type { IProposalRepository } from './ai-design.interface.js';
import type { DesignSpec, NewProposal } from './ai-design.types.js';
import { proposalModel } from './proposal.model.js';
import { ProposalRepository } from './proposal.repository.js';

let mongo: MongoTestHarness;

const portfolioId = new Types.ObjectId().toString();
const otherPortfolioId = new Types.ObjectId().toString();
const userId = new Types.ObjectId().toString();

/** Stored as given: the repository does not validate designs, `IDesignValidator` already did. */
const design = { theme: { colors: {} }, layout: { hero: 'split' } } as unknown as DesignSpec;

function pending(overrides: Partial<NewProposal> = {}): NewProposal {
  return {
    portfolioId,
    userId,
    prompt: 'Calm and editorial',
    scope: 'both',
    basedOnCurrent: true,
    provider: 'stub',
    model: 'stub-fixture',
    charge: { kind: 'free', credits: 0 },
    createdAt: new Date(Date.UTC(2026, 9, 21, 10)),
    ...overrides,
  };
}

const done = { durationMs: 12, completedAt: new Date(Date.UTC(2026, 9, 21, 10, 1)) };

beforeAll(async () => {
  mongo = await MongoTestHarness.start();
  // The partial unique index must exist before the race tests run.
  await proposalModel(mongo.connection.getConnection()).init();
});
afterEach(async () => {
  await mongo.reset();
});
afterAll(async () => {
  await mongo.stop();
});

const subjects: readonly { readonly name: string; readonly create: () => IProposalRepository }[] = [
  { name: 'ProposalRepository', create: () => new ProposalRepository(mongo.connection) },
  { name: 'InMemoryProposalRepository', create: () => new InMemoryProposalRepository() },
];

describe.each(subjects)('ai-design-studio.CT04 — IProposalRepository contract — $name', (subject) => {
  let repository: IProposalRepository;
  beforeEach(() => {
    repository = subject.create();
  });

  it('ai-design-studio.AC1 — inserts a pending proposal with its charge not refunded', async () => {
    const stored = await repository.insertPending(pending());
    expect(stored).toMatchObject({
      portfolioId,
      userId,
      status: 'pending',
      prompt: 'Calm and editorial',
      provider: 'stub',
      model: 'stub-fixture',
      design: null,
      rationale: null,
      failure: null,
      charge: { kind: 'free', credits: 0, refunded: false },
      durationMs: 0,
      completedAt: null,
    });
    expect(await repository.findById(portfolioId, stored.id)).toEqual(stored);
  });

  it('ai-design-studio.AC7 — a second pending proposal for the portfolio is GENERATION_IN_PROGRESS with the id', async () => {
    const first = await repository.insertPending(pending());
    await expect(repository.insertPending(pending())).rejects.toMatchObject({
      status: 409,
      code: 'GENERATION_IN_PROGRESS',
      details: { proposalId: first.id },
    });
    // The rule is per portfolio.
    await expect(repository.insertPending(pending({ portfolioId: otherPortfolioId }))).resolves.toMatchObject({ status: 'pending' });
    // Once the first one ends, a new one may start.
    await repository.complete(portfolioId, first.id, { status: 'failed', failure: { code: 'PROVIDER_ERROR', message: 'x' }, ...done });
    await expect(repository.insertPending(pending())).resolves.toMatchObject({ status: 'pending' });
  });

  it('ai-design-studio.IT14 — of concurrent inserts for one portfolio, exactly one is stored', async () => {
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => repository.insertPending(pending())));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const refused = results.filter((result) => result.status === 'rejected');
    expect(refused).toHaveLength(4);
    for (const result of refused) expect(result.reason).toMatchObject({ code: 'GENERATION_IN_PROGRESS' });
    expect(await repository.countFreeSince(portfolioId, new Date(0))).toBe(1);
  });

  it('reads are scoped to the portfolio; malformed ids find nothing', async () => {
    const stored = await repository.insertPending(pending());
    expect(await repository.findById(otherPortfolioId, stored.id)).toBeNull();
    expect(await repository.findById(portfolioId, new Types.ObjectId().toString())).toBeNull();
    expect(await repository.findById('not-an-id', stored.id)).toBeNull();
    expect(await repository.findById(portfolioId, 'not-an-id')).toBeNull();
    expect(await repository.list('not-an-id', 10)).toEqual([]);
    expect(await repository.countFreeSince('not-an-id', new Date(0))).toBe(0);
  });

  it('completes a pending proposal once, as ready or failed', async () => {
    const first = await repository.insertPending(pending());
    const ready = await repository.complete(portfolioId, first.id, { status: 'ready', design, rationale: 'Quiet', ...done });
    expect(ready).toMatchObject({ status: 'ready', design, rationale: 'Quiet', failure: null, ...done });
    // No longer pending: a second completion changes nothing.
    expect(await repository.complete(portfolioId, first.id, { status: 'failed', failure: { code: 'INTERRUPTED', message: 'x' }, ...done })).toBeNull();
    expect((await repository.findById(portfolioId, first.id))?.status).toBe('ready');

    const second = await repository.insertPending(pending());
    const failed = await repository.complete(portfolioId, second.id, {
      status: 'failed',
      failure: { code: 'INVALID_OUTPUT', message: 'Not JSON' },
      ...done,
    });
    expect(failed).toMatchObject({ status: 'failed', design: null, rationale: null, failure: { code: 'INVALID_OUTPUT', message: 'Not JSON' } });
    expect(await repository.complete(otherPortfolioId, second.id, { status: 'ready', design, rationale: null, ...done })).toBeNull();
    expect(await repository.complete(portfolioId, 'not-an-id', { status: 'ready', design, rationale: null, ...done })).toBeNull();
  });

  it('transitions only from the expected status', async () => {
    const stored = await repository.insertPending(pending());
    expect(await repository.transition(portfolioId, stored.id, 'ready', 'applied')).toBeNull();
    await repository.complete(portfolioId, stored.id, { status: 'ready', design, rationale: null, ...done });
    expect(await repository.transition(otherPortfolioId, stored.id, 'ready', 'applied')).toBeNull();
    expect(await repository.transition(portfolioId, stored.id, 'ready', 'applied')).toMatchObject({ status: 'applied', design });
    expect(await repository.transition(portfolioId, stored.id, 'ready', 'discarded')).toBeNull();
    expect(await repository.transition('not-an-id', stored.id, 'applied', 'discarded')).toBeNull();
  });

  it('lists newest first, excludes discarded, and pages by cursor without skipping ties', async () => {
    const at = (minute: number) => new Date(Date.UTC(2026, 9, 21, 9, minute));
    const ids: string[] = [];
    // Two share a timestamp, so the id breaks the tie.
    for (const minute of [1, 2, 2, 3, 4]) {
      const stored = await repository.insertPending(pending({ createdAt: at(minute) }));
      await repository.complete(portfolioId, stored.id, { status: 'ready', design, rationale: null, ...done });
      ids.push(stored.id);
    }
    await repository.transition(portfolioId, ids[4] ?? '', 'ready', 'discarded');
    await repository.insertPending(pending({ portfolioId: otherPortfolioId }));

    const all = await repository.list(portfolioId, 10);
    expect(all.map((row) => row.id)).toEqual([ids[3], ids[2], ids[1], ids[0]]);

    const firstPage = await repository.list(portfolioId, 2);
    expect(firstPage.map((row) => row.id)).toEqual([ids[3], ids[2]]);
    const secondPage = await repository.list(portfolioId, 2, firstPage.at(-1)?.id);
    expect(secondPage.map((row) => row.id)).toEqual([ids[1], ids[0]]);
    expect(await repository.list(portfolioId, 2, secondPage.at(-1)?.id)).toEqual([]);

    // A cursor from another portfolio, an unknown one or a malformed one yields an empty page.
    const foreign = (await repository.list(otherPortfolioId, 1))[0]?.id;
    expect(await repository.list(portfolioId, 2, foreign)).toEqual([]);
    expect(await repository.list(portfolioId, 2, new Types.ObjectId().toString())).toEqual([]);
    expect(await repository.list(portfolioId, 2, 'not-an-id')).toEqual([]);
  });

  it('ai-design-studio.AC17 — counts free, unrefunded generations since a date, per portfolio', async () => {
    const lastMonth = await repository.insertPending(pending({ createdAt: new Date(Date.UTC(2026, 8, 30, 23, 59)) }));
    await repository.complete(portfolioId, lastMonth.id, { status: 'ready', design, rationale: null, ...done });
    const kinds = [
      { kind: 'free', credits: 0 },
      { kind: 'free', credits: 0 },
      { kind: 'credit', credits: 1 },
      { kind: 'none', credits: 0 },
    ] as const;
    const stored = [];
    for (const charge of kinds) {
      const row = await repository.insertPending(pending({ charge }));
      await repository.complete(portfolioId, row.id, { status: 'ready', design, rationale: null, ...done });
      stored.push(row);
    }
    const monthStart = new Date(Date.UTC(2026, 9, 1));
    expect(await repository.countFreeSince(portfolioId, monthStart)).toBe(2);
    expect(await repository.countFreeSince(otherPortfolioId, monthStart)).toBe(0);

    // A refunded free slot no longer counts.
    expect(await repository.markRefunded(portfolioId, stored[0]?.id ?? '')).toBe(true);
    expect(await repository.countFreeSince(portfolioId, monthStart)).toBe(1);
  });

  it('ai-design-studio.UT16 — refunds a charge once; never an uncharged proposal', async () => {
    const credit = await repository.insertPending(pending({ charge: { kind: 'credit', credits: 1 } }));
    expect(await repository.markRefunded(otherPortfolioId, credit.id)).toBe(false);
    expect(await repository.markRefunded(portfolioId, credit.id)).toBe(true);
    expect(await repository.markRefunded(portfolioId, credit.id)).toBe(false);
    expect((await repository.findById(portfolioId, credit.id))?.charge).toEqual({ kind: 'credit', credits: 1, refunded: true });

    const owner = await repository.insertPending(pending({ portfolioId: otherPortfolioId, charge: { kind: 'none', credits: 0 } }));
    expect(await repository.markRefunded(otherPortfolioId, owner.id)).toBe(false);
    expect(await repository.markRefunded(portfolioId, 'not-an-id')).toBe(false);
  });

  it('ai-design-studio.AC10 — lists the pending proposals of every portfolio', async () => {
    const one = await repository.insertPending(pending());
    const two = await repository.insertPending(pending({ portfolioId: otherPortfolioId }));
    const third = await repository.insertPending(pending({ portfolioId: new Types.ObjectId().toString() }));
    await repository.complete(third.portfolioId, third.id, { status: 'ready', design, rationale: null, ...done });
    expect((await repository.listPending()).map((row) => row.id).sort()).toEqual([one.id, two.id].sort());
  });

  it('deletes a pending proposal only, scoped to the portfolio', async () => {
    const stored = await repository.insertPending(pending());
    expect(await repository.deletePending(otherPortfolioId, stored.id)).toBe(false);
    expect(await repository.deletePending(portfolioId, 'not-an-id')).toBe(false);
    expect(await repository.deletePending(portfolioId, stored.id)).toBe(true);
    expect(await repository.findById(portfolioId, stored.id)).toBeNull();

    const ready = await repository.insertPending(pending());
    await repository.complete(portfolioId, ready.id, { status: 'ready', design, rationale: null, ...done });
    expect(await repository.deletePending(portfolioId, ready.id)).toBe(false);
    expect(await repository.findById(portfolioId, ready.id)).not.toBeNull();
  });
});
