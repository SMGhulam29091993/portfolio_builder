'use client';
/** AI design proposal hooks (`ai-design-studio.T10`; API01–API06). */
import type { AiProviderInfo, CreateProposalRequest, Proposal } from '@portfolio/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CmsDesign } from './design';
import { useApiClient } from './context';

export interface ProposalPage {
  readonly proposals: readonly Proposal[];
  readonly nextCursor: string | null;
}

export const aiKeys = {
  all: ['ai'] as const,
  provider: ['ai', 'provider'] as const,
  history: ['ai', 'proposals'] as const,
  proposal: (id: string) => ['ai', 'proposal', id] as const,
};

/** How often a pending proposal is polled (AC16). */
const POLL_MS = 1_000;
/** How many proposals the history shows. */
const HISTORY_PAGE = 20;

export function useAiProvider() {
  const api = useApiClient();
  return useQuery({ queryKey: aiKeys.provider, queryFn: () => api.request<AiProviderInfo>('/cms/ai/provider') });
}

export function useProposalHistory() {
  const api = useApiClient();
  return useQuery({
    queryKey: aiKeys.history,
    queryFn: () => api.request<ProposalPage>(`/cms/ai/design-proposals?limit=${String(HISTORY_PAGE)}`),
  });
}

/** One proposal, polled while it is pending (API02). */
export function useProposal(id: string | null) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: aiKeys.proposal(id ?? 'none'),
    enabled: id !== null,
    queryFn: async () => {
      const { proposal } = await api.request<{ proposal: Proposal }>(`/cms/ai/design-proposals/${id ?? ''}`);
      // Once it has finished, the history and the allowance (a refund) may have changed.
      if (proposal.status !== 'pending') void queryClient.invalidateQueries({ queryKey: aiKeys.history });
      if (proposal.status !== 'pending') void queryClient.invalidateQueries({ queryKey: aiKeys.provider });
      return proposal;
    },
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? POLL_MS : false),
  });
}

function useRefreshAi() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: aiKeys.all });
}

export function useCreateProposal() {
  const api = useApiClient();
  const refresh = useRefreshAi();
  return useMutation({
    mutationFn: async (body: CreateProposalRequest) =>
      (await api.request<{ proposal: Proposal }>('/cms/ai/design-proposals', { method: 'POST', body })).proposal,
    onSettled: refresh,
  });
}

export function useApplyProposal() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const refresh = useRefreshAi();
  return useMutation({
    mutationFn: ({ id, expectedDesignRevision }: { id: string; expectedDesignRevision: number }) =>
      api.request<{ design: CmsDesign; proposal: Proposal }>(`/cms/ai/design-proposals/${id}/apply`, {
        method: 'POST',
        body: { expectedDesignRevision },
      }),
    onSettled: async () => {
      // The draft design and the layout library both change on apply (`design-library.AC8`).
      await queryClient.invalidateQueries({ queryKey: ['design'] });
      await refresh();
    },
  });
}

/** `ai-design-studio.API07` — save a proposal as a design preset (`design-library`). */
export function useSaveProposalPreset() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.request<{ preset: { id: string; name: string } }>(`/cms/ai/design-proposals/${id}/preset`, { method: 'POST', body: { name } }),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['design'] });
    },
  });
}

export function useDiscardProposal() {
  const api = useApiClient();
  const refresh = useRefreshAi();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.request<{ proposal: Proposal }>(`/cms/ai/design-proposals/${id}`, { method: 'DELETE' })).proposal,
    onSettled: refresh,
  });
}
