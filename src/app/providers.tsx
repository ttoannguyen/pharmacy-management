"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useState } from "react";

const DEFAULT_STORE_SCOPE = "no-store";
const StoreScopeContext = createContext(DEFAULT_STORE_SCOPE);
export type DashboardWorkspace = {
  activeStore: { store: { id: string; code: string; name: string }; role: string } | null;
  memberships: Array<{ storeId: string; store: { id: string; code: string; name: string }; role: string }>;
};
const DashboardWorkspaceContext = createContext<DashboardWorkspace>({ activeStore: null, memberships: [] });

export function useStoreScope() {
  return useContext(StoreScopeContext);
}

export function useDashboardWorkspace() {
  return useContext(DashboardWorkspaceContext);
}

export function AppProviders({ children, workspace }: { children: React.ReactNode; workspace: DashboardWorkspace }) {
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

  const storeScope = workspace.activeStore?.store.id ?? DEFAULT_STORE_SCOPE;
  return <QueryClientProvider client={queryClient}><StoreScopeContext.Provider value={storeScope}><DashboardWorkspaceContext.Provider value={workspace}>{children}</DashboardWorkspaceContext.Provider></StoreScopeContext.Provider></QueryClientProvider>;
}
