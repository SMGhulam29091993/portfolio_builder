'use client';
/** Design hooks (`design-theme.T07`; API01–API03). */
import type { DesignSpec, FontInfo, VariantInfo } from '@portfolio/design-tokens';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiClient } from './context';

export interface CmsDesign extends DesignSpec {
  readonly revision: number;
  readonly updatedAt?: string;
}

export interface DesignResponse {
  readonly design: CmsDesign;
  readonly catalogue: { readonly variants: Readonly<Record<string, readonly VariantInfo[]>>; readonly fonts: readonly FontInfo[] };
}

export const designKeys = { draft: ['design'] as const };

export function useDesign() {
  const api = useApiClient();
  return useQuery({ queryKey: designKeys.draft, queryFn: () => api.request<DesignResponse>('/cms/design') });
}

function useDesignCache() {
  const queryClient = useQueryClient();
  return (design: CmsDesign) => {
    queryClient.setQueryData<DesignResponse>(designKeys.draft, (current) => (current ? { ...current, design } : current));
  };
}

export function useSaveDesign() {
  const api = useApiClient();
  const update = useDesignCache();
  return useMutation({
    mutationFn: async ({ expectedRevision, design }: { expectedRevision: number; design: DesignSpec }) =>
      (await api.request<{ design: CmsDesign }>('/cms/design', { method: 'PUT', body: { expectedRevision, ...design } })).design,
    onSuccess: update,
  });
}

export function useResetDesign() {
  const api = useApiClient();
  const update = useDesignCache();
  return useMutation({
    mutationFn: async (expectedRevision: number) =>
      (await api.request<{ design: CmsDesign }>('/cms/design/reset', { method: 'POST', body: { expectedRevision } })).design,
    onSuccess: update,
  });
}
