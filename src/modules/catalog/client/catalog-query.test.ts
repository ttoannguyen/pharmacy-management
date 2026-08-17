import { describe, expect, it, vi } from "vitest";

import { catalogQueryKeys, createCatalogQueryKeys, invalidateCatalogAfterSkuMutation, resetTenantCatalogCache, storeProductDetailQueryKey, storeProductsQueryKey } from "./catalog-query";

describe("catalog query keys", () => {
  it("keeps list/detail/overview keys under one tenant-sensitive namespace", () => {
    expect(storeProductsQueryKey("para", 2, "store-a")).toEqual(["store", "store-a", "catalog", "products", { query: "para", page: 2 }]);
    expect(storeProductDetailQueryKey("product-1", "store-a")).toEqual(["store", "store-a", "catalog", "product", "product-1"]);
    expect(catalogQueryKeys.overview()).toEqual(["store", "no-store", "catalog", "overview"]);
    expect(createCatalogQueryKeys("store-a").overview()).not.toEqual(createCatalogQueryKeys("store-b").overview());
  });

  it("clears the whole tenant-sensitive namespace on store switch", () => {
    const removeQueries = vi.fn();
    resetTenantCatalogCache({ removeQueries });
    expect(removeQueries).toHaveBeenCalledWith({ queryKey: ["store"] });
  });

  it("starts SKU mutation invalidations together instead of serially", async () => {
    const resolvers: Array<() => void> = [];
    const invalidateQueries = vi.fn((_: { queryKey: readonly unknown[] }) => new Promise<void>((resolve) => resolvers.push(resolve)));
    const pending = invalidateCatalogAfterSkuMutation({ invalidateQueries }, "product-1", "store-a");

    expect(invalidateQueries).toHaveBeenCalledTimes(3);
    expect(invalidateQueries.mock.calls.map(([input]) => input.queryKey)).toEqual([
      ["store", "store-a", "catalog", "product", "product-1"],
      ["store", "store-a", "catalog", "products"],
      ["store", "store-a", "catalog", "overview"],
    ]);
    resolvers.forEach((resolve) => resolve());
    await pending;
  });
});
