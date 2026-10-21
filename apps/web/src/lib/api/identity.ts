'use client';
/** Identity hooks (`site-identity.T07`; API01–API02). */
import type { CmsIdentity, Identity } from '@portfolio/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiClient } from './context';

export const identityKeys = { draft: ['identity'] as const };

export function useIdentity() {
  const api = useApiClient();
  return useQuery({
    queryKey: identityKeys.draft,
    queryFn: async () => (await api.request<{ identity: CmsIdentity }>('/cms/identity')).identity,
  });
}

export function useSaveIdentity() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ expectedRevision, data }: { expectedRevision: number; data: Identity }) =>
      (await api.request<{ identity: CmsIdentity }>('/cms/identity', { method: 'PUT', body: { expectedRevision, data } })).identity,
    onSuccess: (identity) => {
      queryClient.setQueryData(identityKeys.draft, identity);
    },
  });
}
