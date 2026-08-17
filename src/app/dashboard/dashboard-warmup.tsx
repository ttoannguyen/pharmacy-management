"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useStoreScope } from "@/app/providers";
import { catalogOverviewQueryOptions, storeProductsQueryOptions } from "@/modules/catalog/client/catalog-query";

/**
 * Warm only the two routes users reach most often. This is intentionally idle
 * work: it must never delay the shell or compete with an active mutation.
 */
export function DashboardWarmup({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();
  const scope = useStoreScope();

  useEffect(() => {
    if (!enabled || document.visibilityState === "hidden") return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) return;

    const warm = () => {
      void Promise.all([
        queryClient.prefetchQuery(catalogOverviewQueryOptions(scope)),
        queryClient.prefetchQuery(storeProductsQueryOptions("", 1, scope)),
      ]);
    };
    const timer = window.setTimeout(warm, 700);
    return () => window.clearTimeout(timer);
  }, [enabled, queryClient, scope]);

  return null;
}
