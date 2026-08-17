import { describe, expect, it, vi } from "vitest";

import type { GlobalCatalogItem, StoreCatalogItem } from "./catalog-repositories";
import { lookupCatalogBarcode } from "./lookup-catalog";

const localItem = { id: "local-1", storeId: "store-a" } as StoreCatalogItem;
const globalItem = { barcodeId: "global-1", barcode: "893123", verificationStatus: "VERIFIED" } as GlobalCatalogItem;

function repositories(localResult: StoreCatalogItem | null, globalResult: GlobalCatalogItem[]) {
  return {
    local: { findByBarcode: vi.fn().mockResolvedValue(localResult), search: vi.fn() },
    global: { findVerifiedByBarcode: vi.fn().mockResolvedValue(globalResult), searchVerified: vi.fn() },
  };
}

describe("lookupCatalogBarcode", () => {
  it("prioritizes a local match and does not query global data", async () => {
    const repositoriesForTest = repositories(localItem, [globalItem]);
    const result = await lookupCatalogBarcode({ storeId: "store-a", rawBarcode: "893 123", ...repositoriesForTest });

    expect(result.kind).toBe("LOCAL_MATCH");
    expect(result.normalizedBarcode).toBe("893123");
    expect(repositoriesForTest.global.findVerifiedByBarcode).not.toHaveBeenCalled();
  });

  it("returns all verified global candidates when local data is absent", async () => {
    const repositoriesForTest = repositories(null, [globalItem]);
    const result = await lookupCatalogBarcode({ storeId: "store-a", rawBarcode: "893 123", ...repositoriesForTest });

    expect(result.kind).toBe("GLOBAL_MATCHES");
    if (result.kind === "GLOBAL_MATCHES") expect(result.items).toEqual([globalItem]);
  });

  it("returns not found without forcing OCR or another external provider", async () => {
    const repositoriesForTest = repositories(null, []);
    const result = await lookupCatalogBarcode({ storeId: "store-a", rawBarcode: "unknown", ...repositoriesForTest });

    expect(result).toEqual({ kind: "NOT_FOUND", rawBarcode: "unknown", normalizedBarcode: "unknown" });
  });

  it("keeps raw scanner input for audit/debug while querying normalized data", async () => {
    const repositoriesForTest = repositories(null, []);
    await lookupCatalogBarcode({ storeId: "store-a", rawBarcode: " 893-123 ", ...repositoriesForTest });

    expect(repositoriesForTest.local.findByBarcode).toHaveBeenCalledWith("store-a", "893123");
  });
});
