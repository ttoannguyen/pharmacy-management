import { describe, expect, it, vi } from "vitest";

import { createPrismaCatalogOverviewRepository } from "./prisma-catalog-overview";

describe("catalog overview repository", () => {
  it("scopes every aggregate and recent-product query to the active store", async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ product_count: 0n, sku_count: 0n, priced_sku_count: 0n, identified_sku_count: 0n }]);
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = createPrismaCatalogOverviewRepository({
      storeProduct: { findMany } as never,
      $queryRaw: queryRaw as never,
    });

    await repository.load("store-a");

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { storeId: "store-a", isActive: true },
    }));
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("maps a single conditional aggregate row into the overview", async () => {
    const repository = createPrismaCatalogOverviewRepository({
      storeProduct: { findMany: vi.fn().mockResolvedValue([]) } as never,
      $queryRaw: vi.fn().mockResolvedValue([{ product_count: 3n, sku_count: 8n, priced_sku_count: 7n, identified_sku_count: 4n }]) as never,
    });

    await expect(repository.load("store-a")).resolves.toMatchObject({ productCount: 3, skuCount: 8, pricedSkuCount: 7, identifiedSkuCount: 4 });
  });
});
