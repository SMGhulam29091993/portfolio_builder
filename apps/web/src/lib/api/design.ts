'use client';
/** Design hooks (`design-theme.T07`; API01–API03) and the design library (`design-library.T06`). */
import type { DesignPreset, LibraryLayout } from '@portfolio/contracts';
import { customLayoutId, type CustomLayout, type DesignSpec, type FontInfo, type VariantInfo } from '@portfolio/design-tokens';
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

/** The layout library and presets (`design-library.API01`–`API06`). */
export const libraryKeys = { layouts: ['design', 'layouts'] as const, presets: ['design', 'presets'] as const };

export function useLayoutLibrary() {
  const api = useApiClient();
  return useQuery({
    queryKey: libraryKeys.layouts,
    queryFn: async () => (await api.request<{ layouts: LibraryLayout[] }>('/cms/design/layouts')).layouts,
  });
}

export function useDeleteLayout() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.request<{ deleted: true }>(`/cms/design/layouts/${id}`, { method: 'DELETE' }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: libraryKeys.layouts }),
  });
}

export function usePresets() {
  const api = useApiClient();
  return useQuery({
    queryKey: libraryKeys.presets,
    queryFn: async () => (await api.request<{ presets: DesignPreset[] }>('/cms/design/presets')).presets,
  });
}

export function useSavePreset() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => (await api.request<{ preset: DesignPreset }>('/cms/design/presets', { method: 'POST', body: { name } })).preset,
    onSettled: () => queryClient.invalidateQueries({ queryKey: libraryKeys.presets }),
  });
}

export function useApplyPreset() {
  const api = useApiClient();
  const update = useDesignCache();
  return useMutation({
    mutationFn: async ({ id, expectedRevision }: { id: string; expectedRevision: number }) =>
      (await api.request<{ design: CmsDesign }>(`/cms/design/presets/${id}/apply`, { method: 'POST', body: { expectedRevision } })).design,
    onSuccess: update,
  });
}

export function useDeletePreset() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.request<{ deleted: true }>(`/cms/design/presets/${id}`, { method: 'DELETE' }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: libraryKeys.presets }),
  });
}

/**
 * The custom layouts a design names, from the library, by section — what the preview draws for
 * its `custom:<id>` entries (`design-library.AC3`).
 */
export function resolveCustomLayouts(layout: Readonly<Record<string, string>>, library: readonly LibraryLayout[] | undefined): Partial<Record<string, CustomLayout>> {
  const resolved: Partial<Record<string, CustomLayout>> = {};
  for (const [section, entry] of Object.entries(layout)) {
    const id = customLayoutId(entry);
    const found = id === undefined ? undefined : library?.find((item) => item.id === id && item.section === section);
    if (found) resolved[section] = found.layout as CustomLayout;
  }
  return resolved;
}
