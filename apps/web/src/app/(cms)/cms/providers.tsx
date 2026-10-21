'use client';
/**
 * Client providers for every `/cms/**` page (`cms-panel-shell.T01`): one TanStack Query client
 * and one `ApiClient`, created once per browser tab.
 *
 * When the client reports the session gone, the tab goes to the sign-in page carrying the
 * current path as `next` — with the "signed in elsewhere" notice when a newer sign-in replaced
 * this one (`cms-panel-shell.AC3`). Cached data is dropped first, so nothing of the previous
 * session lingers in memory. On the signed-out screens themselves a failed check is the
 * expected answer of their guard (`cms-panel-shell.AC21`), so nothing happens there.
 */
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { ApiClient, ApiError, type SessionLoss } from '../../../lib/api/client';
import { ApiClientProvider } from '../../../lib/api/context';
import { publishingKeys } from '../../../lib/api/publishing';
import { isPublicCmsPath, loginUrl } from '../../../lib/cms/navigation';

export function CmsProviders({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [queryClient] = useState(() => {
    const client: QueryClient = new QueryClient({
      // Any successful write may change the draft, so the header's "Unpublished changes" badge
      // (`cms-panel-shell.AC11`) and the publish screen re-read the status after every one.
      mutationCache: new MutationCache({
        onSuccess: () => {
          void client.invalidateQueries({ queryKey: publishingKeys.all });
        },
      }),
      defaultOptions: {
          queries: {
            // A 4xx is an answer, not a blip; retry only what may be transient.
            retry: (failures, error) =>
              failures < 2 && (!(error instanceof ApiError) || error.status === 0 || error.status >= 500),
            refetchOnWindowFocus: false,
          },
        },
    });
    return client;
  });
  const [apiClient] = useState(
    () =>
      new ApiClient({
        onSessionLost: (reason: SessionLoss) => {
          if (isPublicCmsPath(window.location.pathname)) return;
          queryClient.clear();
          const here = `${window.location.pathname}${window.location.search}`;
          router.replace(loginUrl(here, reason === 'superseded' ? 'signed-out-elsewhere' : undefined));
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ApiClientProvider client={apiClient}>{children}</ApiClientProvider>
    </QueryClientProvider>
  );
}
