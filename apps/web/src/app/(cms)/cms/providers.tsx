'use client';
/**
 * Client providers for every `/cms/**` page (`cms-panel-shell.T01`): one TanStack Query client
 * and one `ApiClient`, created once per browser tab.
 *
 * When the client reports the session gone, the tab goes to the sign-in page carrying the
 * current path as `next` — with the "signed in elsewhere" notice when a newer sign-in replaced
 * this one (`cms-panel-shell.AC3`). Cached data is dropped first, so nothing of the previous
 * session lingers in memory.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { ApiClient, ApiError, type SessionLoss } from '../../../lib/api/client';
import { ApiClientProvider } from '../../../lib/api/context';
import { loginUrl } from '../../../lib/cms/navigation';

export function CmsProviders({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // A 4xx is an answer, not a blip; retry only what may be transient.
            retry: (failures, error) =>
              failures < 2 && (!(error instanceof ApiError) || error.status === 0 || error.status >= 500),
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  const [apiClient] = useState(
    () =>
      new ApiClient({
        onSessionLost: (reason: SessionLoss) => {
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
