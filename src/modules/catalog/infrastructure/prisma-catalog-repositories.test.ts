import { describe, expect, it, vi } from "vitest";

import {
  normalizeBarcode,
  normalizeCatalogQuery,
  normalizePage,
} from "@/modules/catalog/application/catalog-repositories";

import {
  createPrismaGlobalCatalogRepository,
  createPrismaStoreProductDetailRepository,
  createPrismaStoreCatalogRepository,
} from "./prisma-catalog-repositories";

describe("catalog repository boundaries", () => {
  it("normalizes scanner input and clamps pagination", () => {
    expect(normalizeBarcode(" 893 123-456 ")).toBe("893123456");
    expect(normalizeCatalogQuery("  paracetamol   500 mg ")).toBe("paracetamol 500 mg");
    expect(normalizePage({ page: 0, pageSize: 1000 })).toEqual({ page: 1, pageSize: 100 });
  });

  it("classifies exact catalog codes without treating short text as a code", async () => {
    const { normalizeExactCatalogCode, isExactCatalogCode } = await import("@/modules/catalog/application/catalog-repositories");
    expect(isExactCatalogCode("SKU-001")).toBe(true);
    expect(normalizeExactCatalogCode(" sku 001 ")).toBe("SKU001");
    expect(isExactCatalogCode("para")).toBe(true);
    expect(isExactCatalogCode("a")).toBe(false);
  });

  it("always includes the active store in local barcode lookup", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = createPrismaStoreCatalogRepository({
      storeProduct: {} as never,
      storeBarcode: { findFirst } as never,
      globalBarcode: {} as never,
    });

    await repository.findByBarcode("store-a", "893 123");

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ storeId: "store-a", barcode: "893123" }),
    }));
  });

  it("scopes local search and matches product names, SKU codes and barcodes", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const repository = createPrismaStoreCatalogRepository({
      storeProduct: { findMany, count } as never,
      storeBarcode: {} as never,
      globalBarcode: {} as never,
    });

    await repository.search("store-a", " demo-001 ", { page: 1, pageSize: 20 });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        storeId: "store-a",
        OR: expect.arrayContaining([
          { displayName: { contains: "demo-001", mode: "insensitive" } },
          { skus: { some: { isActive: true, code: "DEMO-001" } } },
        ]),
      }),
    }));
    expect(count).not.toHaveBeenCalled();
  });

  it("adds equality predicates for exact SKU/barcode searches", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = createPrismaStoreCatalogRepository({
      storeProduct: { findMany } as never,
      storeBarcode: {} as never,
      globalBarcode: {} as never,
    });

    await repository.search("store-a", " SKU-001 ", { page: 1, pageSize: 20 });

    const where = findMany.mock.calls[0][0].where;
    expect(where.OR).toContainEqual({ skus: { some: { isActive: true, code: "SKU-001" } } });
    expect(where.OR).not.toContainEqual({ skus: { some: { isActive: true, barcodes: { some: { barcode: "SKU001" } } } } });

    await repository.search("store-a", "8931234567890", { page: 1, pageSize: 20 });
    const barcodeWhere = findMany.mock.calls[1][0].where;
    expect(barcodeWhere.OR).toContainEqual({ skus: { some: { isActive: true, barcodes: { some: { barcode: "8931234567890" } } } } });
  });

  it("uses pageSize plus one for hasNextPage without counting the hot path", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "product-1", storeId: "store-a", displayName: "A", shelfLocation: null, baseUnit: { id: "unit", code: "TABLET", name: "Viên" }, skus: [] },
      { id: "product-2", storeId: "store-a", displayName: "B", shelfLocation: null, baseUnit: { id: "unit", code: "TABLET", name: "Viên" }, skus: [] },
      { id: "product-3", storeId: "store-a", displayName: "C", shelfLocation: null, baseUnit: { id: "unit", code: "TABLET", name: "Viên" }, skus: [] },
    ]);
    const count = vi.fn();
    const repository = createPrismaStoreCatalogRepository({
      storeProduct: { findMany, count } as never,
      storeBarcode: {} as never,
      globalBarcode: {} as never,
    });

    const result = await repository.search("store-a", "", { page: 1, pageSize: 2 });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 3 }));
    expect(result.items).toHaveLength(2);
    expect(result.hasNextPage).toBe(true);
    expect(result.total).toBeNull();
    expect(count).not.toHaveBeenCalled();
  });

  it("filters global lookup to verified package and product records", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = createPrismaGlobalCatalogRepository({
      storeProduct: {} as never,
      storeBarcode: {} as never,
      globalBarcode: { findMany } as never,
    });

    await repository.findVerifiedByBarcode("893123");

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        verificationStatus: "VERIFIED",
        productPackage: expect.objectContaining({
          verificationStatus: "VERIFIED",
          registeredProduct: { verificationStatus: "VERIFIED" },
        }),
      }),
    }));
  });

  it("scopes product detail by store and returns a normalized read model", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "product-a",
      storeId: "store-a",
      displayName: "Demo",
      shelfLocation: null,
      minimumStockBase: "10",
      basedOnGlobalVersion: null,
      overrides: { displayName: "Local Demo" },
      isActive: true,
      updatedAt: new Date("2026-08-17T12:00:00.000Z"),
      baseUnit: { id: "unit", code: "TABLET", name: "Viên" },
      skus: [],
      registeredProduct: null,
    });
    const repository = createPrismaStoreProductDetailRepository({ storeProduct: { findFirst } as never });
    const result = await repository.findById("store-a", "product-a");

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { storeId: "store-a", id: "product-a" } }));
    expect(result).toMatchObject({
      storeId: "store-a",
      minimumStockBase: "10",
      updatedAt: "2026-08-17T12:00:00.000Z",
      overrides: { displayName: "Local Demo" },
    });
  });
});
