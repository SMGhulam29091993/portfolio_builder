'use client';
/**
 * Asset hooks (`media-assets.T06`; API01–API04). Uploads go through `XMLHttpRequest` because
 * `fetch` cannot report upload progress (`media-assets.AC11`); a 401 asks the shared API client
 * to refresh the session (through `owner-auth.API04`) and retries the upload once.
 */
import type { AssetKind, AssetReference } from '@portfolio/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { API_BASE, ApiError, type ApiClient } from './client';
import { useApiClient } from './context';

export const assetKeys = {
  all: ['assets'] as const,
  list: (kind?: AssetKind) => ['assets', kind ?? 'all'] as const,
};

/** `media-assets.API02`. */
export function useAssets(kind?: AssetKind) {
  const api = useApiClient();
  return useQuery({
    queryKey: assetKeys.list(kind),
    queryFn: async () =>
      (await api.request<{ assets: AssetReference[] }>(`/cms/assets${kind ? `?kind=${kind}` : ''}`)).assets,
  });
}

/** `media-assets.API03`. */
export function useDeleteAsset() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.request<{ deleted: true }>(`/cms/assets/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: assetKeys.all }),
  });
}

/** `media-assets.API01` with progress (0–1). */
export function useUploadAsset() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, file, onProgress }: { kind: AssetKind; file: File; onProgress: (fraction: number) => void }) =>
      uploadWithRefresh(api, kind, file, onProgress),
    onSettled: () => queryClient.invalidateQueries({ queryKey: assetKeys.all }),
  });
}

async function uploadWithRefresh(
  api: ApiClient,
  kind: AssetKind,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<AssetReference> {
  try {
    return await uploadOnce(kind, file, onProgress);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || error.code === 'SESSION_EXPIRED') throw error;
    // Refreshes (or reports the session lost) exactly as any other CMS call would.
    await api.request('/auth/me');
    return uploadOnce(kind, file, onProgress);
  }
}

function uploadOnce(kind: AssetKind, file: File, onProgress: (fraction: number) => void): Promise<AssetReference> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    // `kind` first: the API reads it before the file part streams in.
    form.append('kind', kind);
    form.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/cms/assets`);
    xhr.withCredentials = true;
    xhr.responseType = 'json';
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onerror = () => {
      reject(new ApiError(0, 'NETWORK_ERROR', {}, 'The server could not be reached'));
    };
    xhr.onload = () => {
      const body = xhr.response as { success?: boolean; message?: string; data?: Record<string, unknown> } | null;
      if (xhr.status >= 200 && xhr.status < 300 && body?.success) {
        resolve((body.data as { asset: AssetReference }).asset);
        return;
      }
      const data = body?.data ?? {};
      reject(new ApiError(xhr.status, typeof data.code === 'string' ? data.code : 'INTERNAL_ERROR', data, body?.message ?? 'Upload failed'));
    };
    xhr.send(form);
  });
}
