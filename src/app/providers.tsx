"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useState } from "react";

const DEFAULT_STORE_SCOPE = "no-store";
const StoreScopeContext = createContext(DEFAULT_STORE_SCOPE);

export function useStoreScope() {
  return useContext(StoreScopeContext);
}

export function AppProviders({ children, storeScope = DEFAULT_STORE_SCOPE }: { children: React.ReactNode; storeScope?: string }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchOnMount: true,
        refetchIntervalInBackground: false,
        retry: 1,
      },
    },
  }));

  return <QueryClientProvider client={queryClient}><StoreScopeContext.Provider value={storeScope}>{children}</StoreScopeContext.Provider></QueryClientProvider>;
}
