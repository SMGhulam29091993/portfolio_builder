/** Public surface of the `ai-design` module: interfaces and types only. */
export type {
  ActiveDesignGenerator,
  IDesignGenerator,
  IDesignPromptBuilder,
  IDesignSpecParser,
  IProposalRepository,
  IProviderHealth,
} from './ai-design.interface.js';
export type {
  AnswerIssue,
  GenerationMessage,
  GenerationRequest,
  GenerationResult,
  NewProposal,
  ParsedAnswer,
  PromptInput,
  ProposalFailure,
  ProposalOutcome,
  StoredProposal,
} from './ai-design.types.js';
