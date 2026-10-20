'use client';
/**
 * Query keys and hooks for the section engine (`cms-panel-shell.T01`; `section-engine.API01`–
 * `API06`). Every write sends `expectedRevision`; the caller handles a 409 by showing the
 * conflict dialog, never by overwriting silently (`int-standards.nextjs.md` → API access).
 * A successful write updates the cached draft in place, so every screen sees the new revision.
 */
import type {
  CmsPortfolio,
  CmsSection,
  PortfolioDraftResponse,
  SectionTypeInfo,
} from '@portfolio/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiClient } from './context';

export const portfolioKeys = {
  draft: ['portfolio', 'draft'] as const,
  types: ['portfolio', 'section-types'] as const,
};

/** The signed-in user's portfolio draft (`section-engine.API01`). */
export function usePortfolioDraft() {
  const api = useApiClient();
  return useQuery({
    queryKey: portfolioKeys.draft,
    queryFn: () => api.request<PortfolioDraftResponse>('/cms/portfolio'),
  });
}

/** The registered section types (`section-engine.API02`). */
export function useSectionTypes() {
  const api = useApiClient();
  return useQuery({
    queryKey: portfolioKeys.types,
    queryFn: async () => (await api.request<{ types: SectionTypeInfo[] }>('/cms/portfolio/section-types')).types,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/** Replaces one section in the cached draft. */
function useSectionCache() {
  const queryClient = useQueryClient();
  return (section: CmsSection) => {
    queryClient.setQueryData<PortfolioDraftResponse>(portfolioKeys.draft, (draft) =>
      draft
        ? { ...draft, sections: draft.sections.map((s) => (s.type === section.type ? section : s)) }
        : draft,
    );
  };
}

/** Replaces the portfolio in the cached draft. */
function usePortfolioCache() {
  const queryClient = useQueryClient();
  return (portfolio: CmsPortfolio) => {
    queryClient.setQueryData<PortfolioDraftResponse>(portfolioKeys.draft, (draft) =>
      draft ? { ...draft, portfolio } : draft,
    );
  };
}

/** `section-engine.API03`. */
export function useSaveSection() {
  const api = useApiClient();
  const update = useSectionCache();
  return useMutation({
    mutationFn: async ({ type, expectedRevision, data }: { type: string; expectedRevision: number; data: unknown }) =>
      (
        await api.request<{ section: CmsSection }>(`/cms/portfolio/sections/${encodeURIComponent(type)}`, {
          method: 'PUT',
          body: { expectedRevision, data },
        })
      ).section,
    onSuccess: update,
  });
}

/** `section-engine.API04`. */
export function useSetVisibility() {
  const api = useApiClient();
  const update = useSectionCache();
  return useMutation({
    mutationFn: async ({ type, expectedRevision, visible }: { type: string; expectedRevision: number; visible: boolean }) =>
      (
        await api.request<{ section: CmsSection }>(
          `/cms/portfolio/sections/${encodeURIComponent(type)}/visibility`,
          { method: 'PATCH', body: { expectedRevision, visible } },
        )
      ).section,
    onSuccess: update,
  });
}

/** `section-engine.API05`. */
export function useReorderSections() {
  const api = useApiClient();
  const update = usePortfolioCache();
  return useMutation({
    mutationFn: async ({ expectedRevision, order }: { expectedRevision: number; order: string[] }) =>
      (
        await api.request<{ portfolio: CmsPortfolio }>('/cms/portfolio/section-order', {
          method: 'PUT',
          body: { expectedRevision, order },
        })
      ).portfolio,
    onSuccess: update,
  });
}

/** `section-engine.API06`. */
export function useChangeSlug() {
  const api = useApiClient();
  const update = usePortfolioCache();
  return useMutation({
    mutationFn: async ({ expectedRevision, slug }: { expectedRevision: number; slug: string }) =>
      (
        await api.request<{ portfolio: CmsPortfolio }>('/cms/portfolio/slug', {
          method: 'PUT',
          body: { expectedRevision, slug },
        })
      ).portfolio,
    onSuccess: update,
  });
}
