"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useStoreScope } from "@/app/providers";

const DEFAULT_STORE_SCOPE = "no-store";

export type StoreProductList = {
  items: Array<{
    id: string;
    displayName: string;
    shelfLocation: string | null;
    baseUnit: { id: string; code: string; name: string };
    skus: Array<{ id: string; code: string; quantityInBaseUnit: string; currentConversionVersion: number; sellingPriceMinor: string; updatedAt: string; barcodes: string[]; unit: { id: string; code: string; name: string } }>;
  }>;
  page: number;
  pageSize: number;
  total: number | null;
  hasNextPage: boolean;
};

export type StoreProductDetail = StoreProductList["items"][number] & {
  updatedAt: string;
  minimumStockBase: string;
  basedOnGlobalVersion: number | null;
  overrides: Record<string, unknown> | null;
  isActive: boolean;
  registeredProduct: { id: string; brandName: string; registrationNumber: string | null; currentVersion: number; verificationStatus: string; manufacturer: { displayName: string } } | null;
};

export type CatalogOverview = {
  productCount: number;
  skuCount: number;
  pricedSkuCount: number;
  identifiedSkuCount: number;
  recentProducts: Array<{ id: string; displayName: string; skuCount: number; updatedAt: string }>;
};

export async function readApi<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { credentials: "include", ...init });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message ?? "Request failed.");
  return body.data as T;
}

export function createCatalogQueryKeys(scope = DEFAULT_STORE_SCOPE) {
  const all = ["store", scope, "catalog"] as const;
  const products = () => [...all, "products"] as const;
  return {
    all,
    products,
    productList: (query: string, page: number) => [...products(), { query, page }] as const,
    product: (productId: string) => [...all, "product", productId] as const,
    overview: () => [...all, "overview"] as const,
    units: () => [...all, "units"] as const,
  };
}

export const catalogQueryKeys = createCatalogQueryKeys();

export async function resetTenantCatalogCache(queryClient: {
  cancelQueries?: (filters: { queryKey: readonly unknown[] }) => Promise<unknown>;
  removeQueries: (filters: { queryKey: readonly unknown[] }) => unknown;
}) {
  // The active store is also part of every key. Removing the common root avoids
  // stale data flashing when a user switches store before the hard reload.
  const queryKey = ["store"] as const;
  if (queryClient.cancelQueries) await queryClient.cancelQueries({ queryKey });
  queryClient.removeQueries({ queryKey });
}

export function invalidateCatalogAfterSkuMutation(
  queryClient: { invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown> },
  productId: string,
  scope = DEFAULT_STORE_SCOPE,
) {
  const keys = createCatalogQueryKeys(scope);
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: keys.product(productId) }),
    queryClient.invalidateQueries({ queryKey: keys.products() }),
    queryClient.invalidateQueries({ queryKey: keys.overview() }),
  ]);
}

export function invalidateCatalogAfterProductMutation(
  queryClient: { invalidateQueries: (filters: { queryKey: readonly unknown[]; refetchType?: "active" }) => Promise<unknown> },
  productId: string,
  scope = DEFAULT_STORE_SCOPE,
) {
  const keys = createCatalogQueryKeys(scope);
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: keys.product(productId), refetchType: "active" }),
    queryClient.invalidateQueries({ queryKey: keys.products(), refetchType: "active" }),
    queryClient.invalidateQueries({ queryKey: keys.overview(), refetchType: "active" }),
  ]);
}

export function storeProductsQueryKey(query: string, page: number, scope = DEFAULT_STORE_SCOPE) {
  return createCatalogQueryKeys(scope).productList(query, page);
}

export function storeProductDetailQueryKey(productId: string, scope = DEFAULT_STORE_SCOPE) {
  return createCatalogQueryKeys(scope).product(productId);
}

export function catalogOverviewQueryKey(scope = DEFAULT_STORE_SCOPE) {
  return createCatalogQueryKeys(scope).overview();
}

export function storeProductsQueryOptions(query: string, page: number, scope = DEFAULT_STORE_SCOPE) {
  return {
    queryKey: storeProductsQueryKey(query, page, scope),
    queryFn: ({ signal }: { signal: AbortSignal }) => readApi<StoreProductList>(`/api/catalog/products?q=${encodeURIComponent(query)}&page=${page}`, { signal }),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  } as const;
}

export function storeProductDetailQueryOptions(productId: string, scope = DEFAULT_STORE_SCOPE) {
  return {
    queryKey: storeProductDetailQueryKey(productId, scope),
    queryFn: ({ signal }: { signal: AbortSignal }) => readApi<{ product: StoreProductDetail }>(`/api/catalog/products/${productId}`, { signal }).then((result) => result.product),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  } as const;
}

export function catalogOverviewQueryOptions(scope = DEFAULT_STORE_SCOPE) {
  return {
    queryKey: catalogOverviewQueryKey(scope),
    queryFn: ({ signal }: { signal: AbortSignal }) => readApi<CatalogOverview>("/api/catalog/overview", { signal }),
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  } as const;
}

export function useCatalogOverview() {
  const scope = useStoreScope();
  return useQuery(catalogOverviewQueryOptions(scope));
}

export function useStoreProducts(query: string, page = 1, initialData?: StoreProductList) {
  const scope = useStoreScope();
  return useQuery({ ...storeProductsQueryOptions(query, page, scope), initialData, placeholderData: keepPreviousData });
}

export function useStoreProductDetail(productId: string, initialData?: StoreProductDetail) {
  const scope = useStoreScope();
  return useQuery({ ...storeProductDetailQueryOptions(productId, scope), initialData });
}

export function useAddStoreSku(productId: string) {
  const queryClient = useQueryClient();
  const scope = useStoreScope();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => readApi<{ sku: unknown }>(`/api/catalog/products/${productId}/skus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
    onSuccess: async () => {
      await invalidateCatalogAfterSkuMutation(queryClient, productId, scope);
    },
  });
}

export function useArchiveStoreSku(productId: string, skuId: string) {
  const queryClient = useQueryClient();
  const scope = useStoreScope();
  return useMutation({
    mutationFn: (reason?: string) => readApi<{ sku: unknown }>(`/api/catalog/products/${productId}/skus/${skuId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reason ? { reason } : {}),
    }),
    onSuccess: () => invalidateCatalogAfterSkuMutation(queryClient, productId, scope),
  });
}

export function useUpdateStoreSku(productId: string, skuId: string) {
  const queryClient = useQueryClient();
  const scope = useStoreScope();
  return useMutation({
    mutationFn: (input: {
      quantityInBaseUnit?: string;
      sellingPriceMinor?: number;
      expectedUpdatedAt: string;
      reason: string;
    }) => readApi<{ sku: unknown }>(`/api/catalog/products/${productId}/skus/${skuId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
    onSuccess: () => invalidateCatalogAfterSkuMutation(queryClient, productId, scope),
  });
}

export function useCreateStoreProduct() {
  const queryClient = useQueryClient();
  const scope = useStoreScope();
  const keys = createCatalogQueryKeys(scope);
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => readApi<{ product: unknown }>("/api/catalog/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.products(), refetchType: "active" }),
      queryClient.invalidateQueries({ queryKey: keys.overview(), refetchType: "active" }),
    ]),
  });
}

export function useUpdateStoreProduct(productId: string) {
  const queryClient = useQueryClient();
  const scope = useStoreScope();
  return useMutation({
    mutationFn: (input: {
      displayName?: string;
      shelfLocation?: string | null;
      minimumStockBase?: string;
      expectedUpdatedAt: string;
      reason: string;
    }) => readApi<{ product: unknown }>(`/api/catalog/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
    onSuccess: () => invalidateCatalogAfterProductMutation(queryClient, productId, scope),
  });
}

export function useArchiveStoreProduct(productId: string) {
  const queryClient = useQueryClient();
  const scope = useStoreScope();
  return useMutation({
    mutationFn: (input: { expectedUpdatedAt: string; reason: string }) => readApi<{ product: unknown }>(`/api/catalog/products/${productId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
    onSuccess: () => invalidateCatalogAfterProductMutation(queryClient, productId, scope),
  });
}
