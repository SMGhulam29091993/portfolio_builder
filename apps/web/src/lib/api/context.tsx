'use client';
/**
 * Hands the one `ApiClient` to the CMS's hooks (`cms-panel-shell.T01`). The CMS providers
 * create it with the shell's session-loss handler; hooks read it with `useApiClient`.
 */
import { createContext, useContext, type ReactNode } from 'react';

import type { ApiClient } from './client';

const ApiClientContext = createContext<ApiClient | null>(null);

export function ApiClientProvider({ client, children }: { client: ApiClient; children: ReactNode }) {
  return <ApiClientContext.Provider value={client}>{children}</ApiClientContext.Provider>;
}

/** The CMS's API client. Throws when used outside the CMS providers — a wiring bug. */
export function useApiClient(): ApiClient {
  const client = useContext(ApiClientContext);
  if (!client) throw new Error('useApiClient must be used inside ApiClientProvider');
  return client;
}
