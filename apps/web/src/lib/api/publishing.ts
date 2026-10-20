'use client';
/** Publishing hooks (`publish-pipeline.T09`; API01–API06). */
import type { PublishingStatus, PublishIssue, RevalidationStatus, SnapshotSummary } from '@portfolio/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiClient } from './context';

export interface ValidationReport {
  readonly publishable: boolean;
  readonly draftContentHash: string;
  readonly issues: readonly PublishIssue[];
}

export interface PublishResult {
  readonly snapshot: { readonly version: number; readonly publishedAt: string; readonly contentHash: string };
  readonly warnings: readonly PublishIssue[];
  readonly revalidation: RevalidationStatus;
}

export interface SnapshotPage {
  readonly snapshots: readonly SnapshotSummary[];
  readonly nextCursor: string | null;
}

export const publishingKeys = {
  all: ['publishing'] as const,
  status: ['publishing', 'status'] as const,
  validation: ['publishing', 'validation'] as const,
  history: ['publishing', 'history'] as const,
};

/** How many versions the history shows at once. */
const HISTORY_PAGE = 20;

export function usePublishingStatus() {
  const api = useApiClient();
  return useQuery({ queryKey: publishingKeys.status, queryFn: () => api.request<PublishingStatus>('/cms/publishing/status') });
}

/** API02 is a POST that writes nothing, so it is read like a query and refetched on demand. */
export function useDraftValidation() {
  const api = useApiClient();
  return useQuery({
    queryKey: publishingKeys.validation,
    queryFn: () => api.request<ValidationReport>('/cms/publishing/validate', { method: 'POST' }),
  });
}

export function useSnapshotHistory() {
  const api = useApiClient();
  return useQuery({
    queryKey: publishingKeys.history,
    queryFn: () => api.request<SnapshotPage>(`/cms/publishing/snapshots?limit=${String(HISTORY_PAGE)}`),
  });
}

/** Everything on the screen depends on the live version, so every change refreshes it all. */
function useRefreshPublishing() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: publishingKeys.all });
}

export function usePublish() {
  const api = useApiClient();
  const refresh = useRefreshPublishing();
  return useMutation({
    mutationFn: (body: { expectedDraftHash: string; note?: string }) =>
      api.request<PublishResult>('/cms/publishing/publish', { method: 'POST', body }),
    onSettled: refresh,
  });
}

export function useActivateSnapshot() {
  const api = useApiClient();
  const refresh = useRefreshPublishing();
  return useMutation({
    mutationFn: (version: number) =>
      api.request<{ snapshot: { version: number }; revalidation: RevalidationStatus }>(
        `/cms/publishing/snapshots/${String(version)}/activate`,
        { method: 'POST' },
      ),
    onSettled: refresh,
  });
}

export function useRevalidate() {
  const api = useApiClient();
  const refresh = useRefreshPublishing();
  return useMutation({
    mutationFn: () => api.request<{ revalidation: RevalidationStatus }>('/cms/publishing/revalidate', { method: 'POST' }),
    onSettled: refresh,
  });
}
