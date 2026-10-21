/**
 * Router factory for AI design proposals, mounted under `/api/v1` (`ai-design-studio.T09`).
 * Documented as `ai-design-studio.API01`–`API07`; each runs `requireOwner` then
 * `resolvePortfolio`, so every proposal read and written belongs to the signed-in user's
 * portfolio (ADR-0010). The AI rate limit guards API01 only — the one route that starts work.
 */
import type { RequestHandler } from 'express';

import { ApiRouter, validate } from '../../core/http/index.js';
import type { AiDesignController } from './ai-design.controller.js';
import {
  applyProposalRequestSchema,
  createProposalRequestSchema,
  listProposalsQuerySchema,
  proposalIdParamsSchema,
  saveProposalPresetRequestSchema,
} from './ai-design.types.js';

export function createAiDesignRouter(
  controller: AiDesignController,
  requireOwner: RequestHandler,
  resolvePortfolio: RequestHandler,
  generationRateLimit: RequestHandler,
): ApiRouter {
  const signedIn = [requireOwner, resolvePortfolio];
  const byId = validate(proposalIdParamsSchema, 'params');
  return new ApiRouter()
    .route('post', '/cms/ai/design-proposals', generationRateLimit, ...signedIn, validate(createProposalRequestSchema), controller.create)
    .route('get', '/cms/ai/design-proposals', ...signedIn, validate(listProposalsQuerySchema, 'query'), controller.list)
    .route('get', '/cms/ai/design-proposals/:id', ...signedIn, byId, controller.get)
    .route('post', '/cms/ai/design-proposals/:id/apply', ...signedIn, byId, validate(applyProposalRequestSchema), controller.apply)
    .route('delete', '/cms/ai/design-proposals/:id', ...signedIn, byId, controller.discard)
    .route('post', '/cms/ai/design-proposals/:id/preset', ...signedIn, byId, validate(saveProposalPresetRequestSchema), controller.savePreset)
    .route('get', '/cms/ai/provider', ...signedIn, controller.provider);
}
