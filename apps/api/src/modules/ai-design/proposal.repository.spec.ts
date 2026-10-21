/**
 * What only the MongoDB `ProposalRepository` has (`ai-design-studio.T01`): the strict schema.
 * Behaviour shared with the fake is in `proposal-repository.contract.spec.ts` (CT04).
 */
import { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MongoTestHarness } from '../../testing/index.js';
import { proposalModel, type ProposalDocument } from './proposal.model.js';

let mongo: MongoTestHarness;

beforeAll(async () => {
  mongo = await MongoTestHarness.start();
});
afterAll(async () => {
  await mongo.stop();
});

describe('design_proposals schema', () => {
  it('refuses a field outside the schema', async () => {
    const model = proposalModel(mongo.connection.getConnection());
    // Typed loosely on purpose: the point is what the schema does with a key the type forbids.
    const withExtraKey: unknown = {
      portfolioId: new Types.ObjectId(),
      userId: new Types.ObjectId(),
      status: 'pending',
      prompt: 'Calm',
      scope: 'both',
      basedOnCurrent: true,
      provider: 'stub',
      model: 'fixture',
      charge: { kind: 'free', credits: 0 },
      createdAt: new Date(),
      html: '<b>',
    };
    await expect(model.create(withExtraKey as ProposalDocument)).rejects.toThrow();
  });
});
