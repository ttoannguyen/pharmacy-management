import { describe, expect, it, vi } from "vitest";

import { MembershipRole, SystemRole } from "@/generated/prisma/client";
import { ForbiddenError } from "@/modules/identity/application/auth-errors";
import type { StoreContext } from "@/modules/identity/application/store-context";

import {
  addStoreSku,
  archiveStoreProduct,
  archiveStoreSku,
  createStoreProduct,
  updateStoreProduct,
  updateStoreSku,
} from "./prisma-store-product-service";

const storeA = "00000000-0000-4000-8000-000000000010";
const storeB = "00000000-0000-4000-8000-000000000011";
const productA = "00000000-0000-4000-8000-000000000020";
const unit = "00000000-0000-4000-8000-000000000001";

const ownerContext: StoreContext = {
  actor: { id: "user-1", email: "owner@example.com", displayName: "Owner", isActive: true, emailVerifiedAt: null, systemRole: SystemRole.USER },
  store: { id: storeA, code: "A", name: "Store A", timezone: "Asia/Bangkok", isActive: true },
  storeId: storeA,
  role: MembershipRole.OWNER,
};

function makeDb(overrides: Record<string, unknown> = {}) {
  const tx = {
    storeProduct: {
      findUnique: vi.fn().mockResolvedValue({ id: productA, storeId: storeA, isActive: true, registeredProductId: null }),
      create: vi.fn().mockResolvedValue({ id: productA, storeId: storeA, displayName: "Para", registeredProductId: null, basedOnGlobalVersion: null }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    registeredProduct: { findUnique: vi.fn() },
    registeredProductVersion: { findUnique: vi.fn() },
    unit: { findUnique: vi.fn().mockResolvedValue({ id: unit }) },
    productPackage: { findFirst: vi.fn() },
    storeSku: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "sku-1", storeId: storeA, storeProductId: productA, code: "SKU-ONE", productPackageId: null, unitId: unit, quantityInBaseUnit: "10", currentConversionVersion: 1, sellingPriceMinor: 2500n, createdAt: new Date("2026-08-17T12:00:00.000Z") }),
      count: vi.fn().mockResolvedValue(1),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({ id: "sku-1", storeId: storeA, storeProductId: productA, code: "SKU-ONE", isActive: false, archivedAt: new Date() }),
    },
    storeSkuConversionVersion: {
      create: vi.fn().mockResolvedValue({ id: "conversion-1" }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    storeBarcode: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "barcode-1" }) },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
    ...overrides,
  };
  return { tx, db: { $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)) } };
}

const input = { code: " sku one ", barcode: "893 123", unitId: unit, quantityInBaseUnit: 10, sellingPriceMinor: 2500 };

describe("createStoreProduct conversion history", () => {
  it("creates conversion version 1 with the initial SKU in the same transaction", async () => {
    const { db, tx } = makeDb();

    await createStoreProduct(db as never, ownerContext, {
      storeId: storeA,
      displayName: "Para",
      baseUnitId: unit,
      minimumStockBase: 0,
      sku: input,
    });

    expect(tx.storeSkuConversionVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        storeId: storeA,
        storeSkuId: "sku-1",
        version: 1,
        quantityInBaseUnit: 10,
        actorId: "user-1",
      }),
    });
    expect(tx.auditLog.create).toHaveBeenCalled();
  });
});

describe("addStoreSku transaction boundary", () => {
  it("scopes product lookup to the active store and audits the created SKU", async () => {
    const { db, tx } = makeDb();
    const result = await addStoreSku(db as never, ownerContext, storeA, productA, input);

    expect(tx.storeProduct.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { storeId_id: { storeId: storeA, id: productA } } }));
    expect(tx.storeSku.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ code: "SKUONE", storeId: storeA }) }));
    expect(tx.storeSkuConversionVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        storeId: storeA,
        storeSkuId: "sku-1",
        version: 1,
        quantityInBaseUnit: "10",
        actorId: "user-1",
      }),
    });
    expect(tx.storeBarcode.create).toHaveBeenCalledWith({ data: { storeId: storeA, storeSkuId: "sku-1", barcode: "893123" } });
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actorId: "user-1", storeId: storeA, targetId: "sku-1", action: "CATALOG_STORE_SKU_CREATED" }) }));
    expect(result.sellingPriceMinor).toBe("2500");
  });

  it("does not allow a foreign store product", async () => {
    const { db, tx } = makeDb();
    tx.storeProduct.findUnique.mockResolvedValue({ id: productA, storeId: storeB, isActive: true, registeredProductId: null });
    await expect(addStoreSku(db as never, ownerContext, storeA, productA, input)).rejects.toMatchObject({ code: "CATALOG_NOT_FOUND" });
    expect(tx.storeSku.create).not.toHaveBeenCalled();
  });

  it("rejects a role without catalog permission before opening a transaction", async () => {
    const { db } = makeDb();
    const accountant = { ...ownerContext, role: MembershipRole.ACCOUNTANT };
    await expect(addStoreSku(db as never, accountant, storeA, productA, input)).rejects.toBeInstanceOf(ForbiddenError);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("returns conflict for duplicate SKU and barcode without audit", async () => {
    const { db, tx } = makeDb();
    tx.storeSku.findUnique.mockResolvedValue({ id: "existing" });
    await expect(addStoreSku(db as never, ownerContext, storeA, productA, input)).rejects.toMatchObject({ code: "CATALOG_CONFLICT" });
    expect(tx.storeSku.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();

    const second = makeDb();
    second.tx.storeBarcode.findUnique.mockResolvedValue({ id: "existing-barcode" });
    await expect(addStoreSku(second.db as never, ownerContext, storeA, productA, input)).rejects.toMatchObject({ code: "CATALOG_CONFLICT" });
  });

  it("rolls the command back before audit if barcode creation fails", async () => {
    const { db, tx } = makeDb();
    tx.storeBarcode.create.mockRejectedValue(new Error("db failure"));
    await expect(addStoreSku(db as never, ownerContext, storeA, productA, input)).rejects.toThrow("db failure");
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("rejects archived products before creating an SKU", async () => {
    const { db, tx } = makeDb();
    tx.storeProduct.findUnique.mockResolvedValue({ id: productA, storeId: storeA, isActive: false, registeredProductId: null });
    await expect(addStoreSku(db as never, ownerContext, storeA, productA, input)).rejects.toMatchObject({ code: "CATALOG_CONFLICT" });
    expect(tx.storeSku.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("allows the same SKU code in another store because uniqueness is tenant-scoped", async () => {
    // The same logical SKU code is valid when the product belongs to another tenant.
    const other = makeDb();
    other.tx.storeProduct.findUnique.mockResolvedValue({ id: productA, storeId: storeB, isActive: true, registeredProductId: null });
    const otherContext = { ...ownerContext, storeId: storeB, store: { ...ownerContext.store, id: storeB } };
    await expect(addStoreSku(other.db as never, otherContext, storeB, productA, input)).resolves.toBeTruthy();
  });
});

describe("archiveStoreSku transaction boundary", () => {
  it("archives only the tenant SKU and writes an audit event", async () => {
    const { db, tx } = makeDb();
    tx.storeSku.findUnique.mockResolvedValue({ id: "sku-1", storeId: storeA, storeProductId: productA, code: "SKU-ONE", isActive: true, archivedAt: null });
    const result = await archiveStoreSku(db as never, ownerContext, storeA, productA, "sku-1", { reason: "Ngừng bán" });

    expect(tx.storeSku.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { storeId_id: { storeId: storeA, id: "sku-1" } } }));
    expect(tx.storeSku.update).toHaveBeenCalledWith(expect.objectContaining({ where: { storeId_id: { storeId: storeA, id: "sku-1" } }, data: expect.objectContaining({ isActive: false }) }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "CATALOG_STORE_SKU_ARCHIVED", reason: "Ngừng bán", storeId: storeA }) }));
    expect(result.isActive).toBe(false);
  });

  it("does not archive the last active SKU of a product", async () => {
    const { db, tx } = makeDb();
    tx.storeSku.findUnique.mockResolvedValue({ id: "sku-1", storeId: storeA, storeProductId: productA, code: "SKU-ONE", isActive: true, archivedAt: null });
    tx.storeSku.count.mockResolvedValue(0);

    await expect(archiveStoreSku(db as never, ownerContext, storeA, productA, "sku-1", { reason: "Không còn kinh doanh" })).rejects.toMatchObject({ code: "CATALOG_CONFLICT" });
    expect(tx.storeSku.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("updateStoreSku transaction boundary", () => {
  const before = {
    id: "sku-1",
    storeId: storeA,
    storeProductId: productA,
    code: "SKU-ONE",
    isActive: true,
    quantityInBaseUnit: "10",
    currentConversionVersion: 1,
    sellingPriceMinor: 2500n,
    updatedAt: new Date("2026-08-17T12:00:00.000Z"),
  };
  const after = {
    ...before,
    quantityInBaseUnit: "12",
    currentConversionVersion: 2,
    sellingPriceMinor: 3000n,
    updatedAt: new Date("2026-08-17T12:01:00.000Z"),
  };
  const updateInput = {
    quantityInBaseUnit: "12",
    sellingPriceMinor: 3000,
    expectedUpdatedAt: before.updatedAt.toISOString(),
    reason: "Điều chỉnh giá và quy đổi",
  };

  it("updates with an optimistic version guard and audits safe before/after snapshots", async () => {
    const { db, tx } = makeDb();
    tx.storeSku.findUnique.mockResolvedValueOnce(before).mockResolvedValueOnce(after);

    const result = await updateStoreSku(db as never, ownerContext, storeA, productA, "sku-1", updateInput);

    expect(tx.storeSku.updateMany).toHaveBeenCalledWith({
      where: {
        storeId: storeA,
        id: "sku-1",
        storeProductId: productA,
        isActive: true,
        updatedAt: before.updatedAt,
      },
      data: { quantityInBaseUnit: "12", currentConversionVersion: 2, sellingPriceMinor: 3000n },
    });
    expect(tx.storeSkuConversionVersion.updateMany).toHaveBeenCalledWith({
      where: { storeId: storeA, storeSkuId: "sku-1", version: 1, effectiveTo: null },
      data: { effectiveTo: expect.any(Date) },
    });
    expect(tx.storeSkuConversionVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        storeId: storeA,
        storeSkuId: "sku-1",
        version: 2,
        quantityInBaseUnit: "12",
        reason: updateInput.reason,
        actorId: "user-1",
      }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        storeId: storeA,
        actorId: "user-1",
        action: "CATALOG_STORE_SKU_PRICE_CONVERSION_UPDATED",
        targetId: "sku-1",
        reason: updateInput.reason,
        before: expect.objectContaining({ quantityInBaseUnit: "10", currentConversionVersion: 1, sellingPriceMinor: "2500" }),
        after: expect.objectContaining({ quantityInBaseUnit: "12", currentConversionVersion: 2, sellingPriceMinor: "3000" }),
      }),
    }));
    expect(result).toMatchObject({ quantityInBaseUnit: "12", currentConversionVersion: 2, sellingPriceMinor: "3000", updatedAt: after.updatedAt.toISOString() });
  });

  it("rejects foreign, archived, unchanged and stale SKUs without audit", async () => {
    const foreign = makeDb();
    foreign.tx.storeSku.findUnique.mockResolvedValue({ ...before, storeId: storeB });
    await expect(updateStoreSku(foreign.db as never, ownerContext, storeA, productA, "sku-1", updateInput)).rejects.toMatchObject({ code: "CATALOG_NOT_FOUND" });
    expect(foreign.tx.storeSku.updateMany).not.toHaveBeenCalled();

    const archived = makeDb();
    archived.tx.storeSku.findUnique.mockResolvedValue({ ...before, isActive: false });
    await expect(updateStoreSku(archived.db as never, ownerContext, storeA, productA, "sku-1", updateInput)).rejects.toMatchObject({ code: "CATALOG_CONFLICT" });

    const unchanged = makeDb();
    unchanged.tx.storeSku.findUnique.mockResolvedValue(before);
    await expect(updateStoreSku(unchanged.db as never, ownerContext, storeA, productA, "sku-1", {
      ...updateInput,
      quantityInBaseUnit: "10",
      sellingPriceMinor: 2500,
    })).rejects.toMatchObject({ code: "CATALOG_CONFLICT" });

    const stale = makeDb();
    stale.tx.storeSku.findUnique.mockResolvedValue(before);
    stale.tx.storeSku.updateMany.mockResolvedValue({ count: 0 });
    await expect(updateStoreSku(stale.db as never, ownerContext, storeA, productA, "sku-1", updateInput)).rejects.toMatchObject({ code: "CATALOG_CONFLICT" });
    expect(stale.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("rejects roles without catalog permission before opening a transaction", async () => {
    const { db } = makeDb();
    const accountant = { ...ownerContext, role: MembershipRole.ACCOUNTANT };
    await expect(updateStoreSku(db as never, accountant, storeA, productA, "sku-1", updateInput)).rejects.toBeInstanceOf(ForbiddenError);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("does not commit an unaudited update when audit creation fails", async () => {
    const { db, tx } = makeDb();
    tx.storeSku.findUnique.mockResolvedValueOnce(before).mockResolvedValueOnce(after);
    tx.auditLog.create.mockRejectedValue(new Error("audit unavailable"));

    await expect(updateStoreSku(db as never, ownerContext, storeA, productA, "sku-1", updateInput)).rejects.toThrow("audit unavailable");
    expect(tx.storeSku.updateMany).toHaveBeenCalled();
  });

  it("does not create a conversion version for a price-only update", async () => {
    const { db, tx } = makeDb();
    const priceOnlyAfter = { ...before, sellingPriceMinor: 3000n, updatedAt: after.updatedAt };
    tx.storeSku.findUnique.mockResolvedValueOnce(before).mockResolvedValueOnce(priceOnlyAfter);

    await updateStoreSku(db as never, ownerContext, storeA, productA, "sku-1", {
      sellingPriceMinor: 3000,
      expectedUpdatedAt: before.updatedAt.toISOString(),
      reason: "Điều chỉnh giá bán",
    });

    expect(tx.storeSku.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { sellingPriceMinor: 3000n },
    }));
    expect(tx.storeSkuConversionVersion.updateMany).not.toHaveBeenCalled();
    expect(tx.storeSkuConversionVersion.create).not.toHaveBeenCalled();
  });

  it("rolls back when the current conversion version cannot be closed", async () => {
    const { db, tx } = makeDb();
    tx.storeSku.findUnique.mockResolvedValue(before);
    tx.storeSkuConversionVersion.updateMany.mockResolvedValue({ count: 0 });

    await expect(updateStoreSku(db as never, ownerContext, storeA, productA, "sku-1", updateInput))
      .rejects.toMatchObject({ code: "CATALOG_CONFLICT" });
    expect(tx.storeSkuConversionVersion.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("store product lifecycle transaction boundary", () => {
  const before = {
    id: productA,
    storeId: storeA,
    registeredProductId: null,
    displayName: "Para cũ",
    shelfLocation: "A1",
    minimumStockBase: "5",
    overrides: { displayName: "Para cũ" },
    isActive: true,
    archivedAt: null,
    updatedAt: new Date("2026-08-17T12:00:00.000Z"),
  };
  const after = {
    ...before,
    displayName: "Para mới",
    shelfLocation: "B2",
    minimumStockBase: "10.5",
    updatedAt: new Date("2026-08-17T12:01:00.000Z"),
  };

  it("updates exact local fields with optimistic concurrency and audit", async () => {
    const { db, tx } = makeDb();
    tx.storeProduct.findUnique.mockResolvedValueOnce(before).mockResolvedValueOnce(after);

    const result = await updateStoreProduct(db as never, ownerContext, storeA, productA, {
      displayName: "Para mới",
      shelfLocation: "B2",
      minimumStockBase: "10.500000",
      expectedUpdatedAt: before.updatedAt.toISOString(),
      reason: "Cập nhật thông tin local",
    });

    expect(tx.storeProduct.updateMany).toHaveBeenCalledWith({
      where: { storeId: storeA, id: productA, isActive: true, updatedAt: before.updatedAt },
      data: { displayName: "Para mới", shelfLocation: "B2", minimumStockBase: "10.500000" },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "CATALOG_STORE_PRODUCT_UPDATED",
        storeId: storeA,
        actorId: "user-1",
        reason: "Cập nhật thông tin local",
        before: expect.objectContaining({ minimumStockBase: "5" }),
        after: expect.objectContaining({ minimumStockBase: "10.5" }),
      }),
    }));
    expect(result).toMatchObject({ displayName: "Para mới", minimumStockBase: "10.5", updatedAt: after.updatedAt.toISOString() });
  });

  it("records a linked product display-name edit as an explicit local override", async () => {
    const { db, tx } = makeDb();
    const linkedBefore = {
      ...before,
      registeredProductId: "60000000-0000-4000-8000-000000000001",
      overrides: { note: "keep" },
    };
    const linkedAfter = {
      ...after,
      registeredProductId: linkedBefore.registeredProductId,
      displayName: "Para local",
      overrides: { note: "keep", displayName: "Para local" },
    };
    tx.storeProduct.findUnique.mockResolvedValueOnce(linkedBefore).mockResolvedValueOnce(linkedAfter);

    await updateStoreProduct(db as never, ownerContext, storeA, productA, {
      displayName: "Para local",
      expectedUpdatedAt: linkedBefore.updatedAt.toISOString(),
      reason: "Tên bán tại nhà thuốc",
    });

    expect(tx.storeProduct.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        displayName: "Para local",
        overrides: { note: "keep", displayName: "Para local" },
      },
    }));
  });

  it("rejects foreign, archived, unchanged and stale product writes", async () => {
    const input = {
      displayName: "Para mới",
      expectedUpdatedAt: before.updatedAt.toISOString(),
      reason: "Cập nhật tên",
    };

    const foreign = makeDb();
    foreign.tx.storeProduct.findUnique.mockResolvedValue({ ...before, storeId: storeB });
    await expect(updateStoreProduct(foreign.db as never, ownerContext, storeA, productA, input))
      .rejects.toMatchObject({ code: "CATALOG_NOT_FOUND" });

    const archived = makeDb();
    archived.tx.storeProduct.findUnique.mockResolvedValue({ ...before, isActive: false });
    await expect(updateStoreProduct(archived.db as never, ownerContext, storeA, productA, input))
      .rejects.toMatchObject({ code: "CATALOG_CONFLICT" });

    const unchanged = makeDb();
    unchanged.tx.storeProduct.findUnique.mockResolvedValue(before);
    await expect(updateStoreProduct(unchanged.db as never, ownerContext, storeA, productA, {
      ...input,
      displayName: before.displayName,
    })).rejects.toMatchObject({ code: "CATALOG_CONFLICT" });

    const stale = makeDb();
    stale.tx.storeProduct.findUnique.mockResolvedValue(before);
    stale.tx.storeProduct.updateMany.mockResolvedValue({ count: 0 });
    await expect(updateStoreProduct(stale.db as never, ownerContext, storeA, productA, input))
      .rejects.toMatchObject({ code: "CATALOG_CONFLICT" });
    expect(stale.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("soft-archives the tenant product with reason and version guard", async () => {
    const { db, tx } = makeDb();
    const archived = {
      id: productA,
      storeId: storeA,
      displayName: before.displayName,
      isActive: false,
      archivedAt: new Date("2026-08-17T12:02:00.000Z"),
      updatedAt: new Date("2026-08-17T12:02:00.000Z"),
    };
    tx.storeProduct.findUnique.mockResolvedValueOnce(before).mockResolvedValueOnce(archived);

    const result = await archiveStoreProduct(db as never, ownerContext, storeA, productA, {
      expectedUpdatedAt: before.updatedAt.toISOString(),
      reason: "Ngừng kinh doanh",
    });

    expect(tx.storeProduct.updateMany).toHaveBeenCalledWith({
      where: { storeId: storeA, id: productA, isActive: true, updatedAt: before.updatedAt },
      data: { isActive: false, archivedAt: expect.any(Date) },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "CATALOG_STORE_PRODUCT_ARCHIVED",
        reason: "Ngừng kinh doanh",
        storeId: storeA,
      }),
    }));
    expect(result).toMatchObject({ isActive: false, updatedAt: archived.updatedAt.toISOString() });
  });

  it("rejects product lifecycle roles without catalog permission before transaction", async () => {
    const { db } = makeDb();
    const accountant = { ...ownerContext, role: MembershipRole.ACCOUNTANT };
    const input = {
      expectedUpdatedAt: before.updatedAt.toISOString(),
      reason: "Không có quyền",
    };
    await expect(archiveStoreProduct(db as never, accountant, storeA, productA, input))
      .rejects.toBeInstanceOf(ForbiddenError);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
