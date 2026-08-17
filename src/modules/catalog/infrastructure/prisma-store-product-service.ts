import { Prisma, type PrismaClient } from "@/generated/prisma/client";

import {
  assertStoreProductInput,
  assertUpdateStoreProduct,
  assertArchiveStoreProduct,
  assertAddStoreSku,
  assertUpdateStoreSku,
  assertArchiveStoreSku,
  CatalogConflictError,
  CatalogNotFoundError,
  GlobalCatalogLinkError,
  type StoreProductInput,
  type UpdateStoreProductInput,
  type ArchiveStoreProductInput,
  type AddStoreSkuInput,
  type UpdateStoreSkuInput,
  type ArchiveStoreSkuInput,
} from "@/modules/catalog/application/store-product-service";
import type { StoreContext } from "@/modules/identity/application/store-context";
import { normalizeBarcode } from "@/modules/catalog/application/catalog-repositories";

export async function createStoreProduct(
  db: PrismaClient,
  context: StoreContext,
  rawInput: StoreProductInput,
) {
  const input = assertStoreProductInput(context, rawInput);

  return db.$transaction(async (tx) => {
    const baseUnit = await tx.unit.findUnique({ where: { id: input.baseUnitId } });
    if (!baseUnit) throw new Error("Base unit does not exist.");

    if (input.sku) {
      const skuUnit = await tx.unit.findUnique({ where: { id: input.sku.unitId } });
      if (!skuUnit) throw new Error("SKU unit does not exist.");
    }

    let basedOnGlobalVersion: number | null = null;
    if (input.registeredProductId) {
      const product = await tx.registeredProduct.findUnique({
        where: { id: input.registeredProductId },
        select: { id: true, currentVersion: true, verificationStatus: true },
      });
      if (!product || product.verificationStatus !== "VERIFIED") {
        throw new GlobalCatalogLinkError("Only verified global products can be linked.");
      }
      basedOnGlobalVersion = input.basedOnGlobalVersion ?? product.currentVersion;
      const version = await tx.registeredProductVersion.findUnique({
        where: { registeredProductId_version: { registeredProductId: product.id, version: basedOnGlobalVersion } },
        select: { id: true },
      });
      if (!version) throw new GlobalCatalogLinkError("The selected global product version does not exist.");

      if (input.sku?.productPackageId) {
        const productPackage = await tx.productPackage.findFirst({
          where: {
            id: input.sku.productPackageId,
            registeredProductId: product.id,
            verificationStatus: "VERIFIED",
          },
          select: { id: true },
        });
        if (!productPackage) throw new GlobalCatalogLinkError("The selected package is not valid for this product.");
      }
    } else if (input.sku?.productPackageId) {
      throw new GlobalCatalogLinkError("A package can only be linked with a registered product.");
    }

    const product = await tx.storeProduct.create({
      data: {
        storeId: input.storeId,
        displayName: input.displayName,
        baseUnitId: input.baseUnitId,
        shelfLocation: input.shelfLocation,
        minimumStockBase: input.minimumStockBase,
        registeredProductId: input.registeredProductId,
        basedOnGlobalVersion,
        overrides: input.overrides as Prisma.InputJsonValue | undefined,
      },
    });

    if (input.sku) {
      const sku = await tx.storeSku.create({
        data: {
          storeId: input.storeId,
          storeProductId: product.id,
          code: input.sku.code,
          productPackageId: input.sku.productPackageId,
          unitId: input.sku.unitId,
          quantityInBaseUnit: input.sku.quantityInBaseUnit,
          sellingPriceMinor: BigInt(input.sku.sellingPriceMinor),
        },
      });
      await tx.storeSkuConversionVersion.create({
        data: {
          storeId: input.storeId,
          storeSkuId: sku.id,
          version: 1,
          quantityInBaseUnit: input.sku.quantityInBaseUnit,
          effectiveFrom: sku.createdAt,
          reason: "Initial conversion for store product creation",
          actorId: context.actor.id,
        },
      });
      const barcode = input.sku.barcode ? normalizeBarcode(input.sku.barcode) : "";
      if (barcode) {
        await tx.storeBarcode.create({ data: { storeId: input.storeId, storeSkuId: sku.id, barcode } });
      }
    }

    await tx.auditLog.create({
      data: {
        storeId: input.storeId,
        actorId: context.actor.id,
        action: "CATALOG_STORE_PRODUCT_CREATED",
        targetType: "StoreProduct",
        targetId: product.id,
        reason: "Created store catalog product",
        after: {
          displayName: product.displayName,
          registeredProductId: product.registeredProductId,
          basedOnGlobalVersion,
          sku: input.sku,
        },
      },
    });

    return product;
  });
}

export async function updateStoreProduct(
  db: PrismaClient,
  context: StoreContext,
  storeId: string,
  productId: string,
  rawInput: UpdateStoreProductInput,
) {
  const input = assertUpdateStoreProduct(context, storeId, rawInput);
  const expectedUpdatedAt = new Date(input.expectedUpdatedAt);

  return db.$transaction(async (tx) => {
    const before = await tx.storeProduct.findUnique({
      where: { storeId_id: { storeId, id: productId } },
      select: {
        id: true,
        storeId: true,
        registeredProductId: true,
        displayName: true,
        shelfLocation: true,
        minimumStockBase: true,
        overrides: true,
        isActive: true,
        updatedAt: true,
      },
    });
    if (!before || before.storeId !== context.storeId) {
      throw new CatalogNotFoundError("Store product not found.");
    }
    if (!before.isActive) throw new CatalogConflictError("Archived products cannot be updated.");

    const displayNameChanged = input.displayName !== undefined && input.displayName !== before.displayName;
    const shelfLocationChanged = input.shelfLocation !== undefined && input.shelfLocation !== before.shelfLocation;
    const minimumStockChanged = input.minimumStockBase !== undefined
      && !new Prisma.Decimal(input.minimumStockBase).equals(before.minimumStockBase);
    const currentOverrides = before.overrides && typeof before.overrides === "object" && !Array.isArray(before.overrides)
      ? before.overrides as Record<string, unknown>
      : {};
    const nextOverrides = input.overrides !== undefined
      ? { ...input.overrides }
      : { ...currentOverrides };
    if (displayNameChanged && before.registeredProductId) nextOverrides.displayName = input.displayName;
    const shouldWriteOverrides = input.overrides !== undefined || (displayNameChanged && Boolean(before.registeredProductId));
    const overridesChanged = shouldWriteOverrides
      && JSON.stringify(nextOverrides) !== JSON.stringify(before.overrides);
    if (!displayNameChanged && !shelfLocationChanged && !minimumStockChanged && !overridesChanged) {
      throw new CatalogConflictError("Store product values are unchanged.");
    }

    const updateResult = await tx.storeProduct.updateMany({
      where: { storeId, id: productId, isActive: true, updatedAt: expectedUpdatedAt },
      data: {
        ...(displayNameChanged ? { displayName: input.displayName } : {}),
        ...(shelfLocationChanged ? { shelfLocation: input.shelfLocation } : {}),
        ...(minimumStockChanged ? { minimumStockBase: input.minimumStockBase } : {}),
        ...(overridesChanged ? { overrides: nextOverrides as Prisma.InputJsonValue } : {}),
      },
    });
    if (updateResult.count !== 1) {
      throw new CatalogConflictError("Product changed in another session. Refresh before retrying.");
    }

    const after = await tx.storeProduct.findUnique({
      where: { storeId_id: { storeId, id: productId } },
      select: {
        id: true,
        storeId: true,
        registeredProductId: true,
        displayName: true,
        shelfLocation: true,
        minimumStockBase: true,
        overrides: true,
        isActive: true,
        updatedAt: true,
      },
    });
    if (!after) throw new CatalogNotFoundError("Updated store product not found.");

    await tx.auditLog.create({
      data: {
        storeId,
        actorId: context.actor.id,
        action: "CATALOG_STORE_PRODUCT_UPDATED",
        targetType: "StoreProduct",
        targetId: productId,
        reason: input.reason,
        before: {
          displayName: before.displayName,
          shelfLocation: before.shelfLocation,
          minimumStockBase: String(before.minimumStockBase),
          overrides: before.overrides as Prisma.InputJsonValue | undefined,
          updatedAt: before.updatedAt.toISOString(),
        },
        after: {
          displayName: after.displayName,
          shelfLocation: after.shelfLocation,
          minimumStockBase: String(after.minimumStockBase),
          overrides: after.overrides as Prisma.InputJsonValue | undefined,
          updatedAt: after.updatedAt.toISOString(),
        },
      },
    });

    return {
      ...after,
      minimumStockBase: String(after.minimumStockBase),
      updatedAt: after.updatedAt.toISOString(),
    };
  });
}

export async function archiveStoreProduct(
  db: PrismaClient,
  context: StoreContext,
  storeId: string,
  productId: string,
  rawInput: ArchiveStoreProductInput,
) {
  const input = assertArchiveStoreProduct(context, storeId, rawInput);
  const expectedUpdatedAt = new Date(input.expectedUpdatedAt);

  return db.$transaction(async (tx) => {
    const before = await tx.storeProduct.findUnique({
      where: { storeId_id: { storeId, id: productId } },
      select: {
        id: true,
        storeId: true,
        displayName: true,
        isActive: true,
        archivedAt: true,
        updatedAt: true,
      },
    });
    if (!before || before.storeId !== context.storeId) {
      throw new CatalogNotFoundError("Store product not found.");
    }
    if (!before.isActive) throw new CatalogConflictError("Store product is already archived.");

    const archivedAt = new Date();
    const archiveResult = await tx.storeProduct.updateMany({
      where: { storeId, id: productId, isActive: true, updatedAt: expectedUpdatedAt },
      data: { isActive: false, archivedAt },
    });
    if (archiveResult.count !== 1) {
      throw new CatalogConflictError("Product changed in another session. Refresh before retrying.");
    }

    const after = await tx.storeProduct.findUnique({
      where: { storeId_id: { storeId, id: productId } },
      select: {
        id: true,
        storeId: true,
        displayName: true,
        isActive: true,
        archivedAt: true,
        updatedAt: true,
      },
    });
    if (!after) throw new CatalogNotFoundError("Archived store product not found.");

    await tx.auditLog.create({
      data: {
        storeId,
        actorId: context.actor.id,
        action: "CATALOG_STORE_PRODUCT_ARCHIVED",
        targetType: "StoreProduct",
        targetId: productId,
        reason: input.reason,
        before: {
          displayName: before.displayName,
          isActive: before.isActive,
          archivedAt: before.archivedAt,
          updatedAt: before.updatedAt.toISOString(),
        },
        after: {
          displayName: after.displayName,
          isActive: after.isActive,
          archivedAt: after.archivedAt,
          updatedAt: after.updatedAt.toISOString(),
        },
      },
    });

    return { ...after, updatedAt: after.updatedAt.toISOString() };
  });
}

export async function addStoreSku(
  db: PrismaClient,
  context: StoreContext,
  storeId: string,
  productId: string,
  rawInput: AddStoreSkuInput,
) {
  const input = assertAddStoreSku(context, storeId, rawInput);

  return db.$transaction(async (tx) => {
    const product = await tx.storeProduct.findUnique({
      where: { storeId_id: { storeId, id: productId } },
      select: { id: true, storeId: true, isActive: true, registeredProductId: true },
    });
    if (!product || product.storeId !== context.storeId) throw new CatalogNotFoundError("Store product not found.");
    if (!product.isActive) throw new CatalogConflictError("Archived products cannot receive new SKUs.");

    const unit = await tx.unit.findUnique({ where: { id: input.unitId }, select: { id: true } });
    if (!unit) throw new CatalogNotFoundError("SKU unit not found.");

    if (input.productPackageId) {
      if (!product.registeredProductId) throw new CatalogConflictError("A package requires a linked registered product.");
      const productPackage = await tx.productPackage.findFirst({
        where: {
          id: input.productPackageId,
          registeredProductId: product.registeredProductId,
          verificationStatus: "VERIFIED",
        },
        select: { id: true },
      });
      if (!productPackage) throw new CatalogNotFoundError("Product package not found.");
    }

    const existingSku = await tx.storeSku.findUnique({ where: { storeId_code: { storeId, code: input.code } }, select: { id: true } });
    if (existingSku) throw new CatalogConflictError("SKU code already exists in this store.");

    const normalizedBarcode = input.barcode ? normalizeBarcode(input.barcode) : "";
    if (normalizedBarcode) {
      const existingBarcode = await tx.storeBarcode.findUnique({ where: { storeId_barcode: { storeId, barcode: normalizedBarcode } }, select: { id: true } });
      if (existingBarcode) throw new CatalogConflictError("Barcode already exists in this store.");
    }

    const sku = await tx.storeSku.create({
      data: {
        storeId,
        storeProductId: product.id,
        productPackageId: input.productPackageId,
        unitId: input.unitId,
        code: input.code,
        quantityInBaseUnit: input.quantityInBaseUnit,
        sellingPriceMinor: BigInt(input.sellingPriceMinor),
      },
      select: { id: true, storeId: true, storeProductId: true, code: true, productPackageId: true, unitId: true, quantityInBaseUnit: true, currentConversionVersion: true, sellingPriceMinor: true, createdAt: true },
    });

    await tx.storeSkuConversionVersion.create({
      data: {
        storeId,
        storeSkuId: sku.id,
        version: sku.currentConversionVersion,
        quantityInBaseUnit: sku.quantityInBaseUnit,
        effectiveFrom: sku.createdAt,
        reason: "Initial conversion for added SKU",
        actorId: context.actor.id,
      },
    });

    if (normalizedBarcode) {
      await tx.storeBarcode.create({ data: { storeId, storeSkuId: sku.id, barcode: normalizedBarcode } });
    }

    await tx.auditLog.create({
      data: {
        storeId,
        actorId: context.actor.id,
        action: "CATALOG_STORE_SKU_CREATED",
        targetType: "StoreSku",
        targetId: sku.id,
        reason: "Added SKU to store product",
        before: Prisma.JsonNull,
        after: {
          storeProductId: product.id,
          code: sku.code,
          unitId: sku.unitId,
          productPackageId: sku.productPackageId,
          quantityInBaseUnit: String(sku.quantityInBaseUnit),
          currentConversionVersion: sku.currentConversionVersion,
          sellingPriceMinor: sku.sellingPriceMinor.toString(),
          barcode: normalizedBarcode || null,
        },
      },
    });

    return { ...sku, quantityInBaseUnit: String(sku.quantityInBaseUnit), sellingPriceMinor: sku.sellingPriceMinor.toString(), createdAt: sku.createdAt.toISOString(), barcode: normalizedBarcode || null };
  });
}

export async function archiveStoreSku(
  db: PrismaClient,
  context: StoreContext,
  storeId: string,
  productId: string,
  skuId: string,
  rawInput: ArchiveStoreSkuInput,
) {
  const input = assertArchiveStoreSku(context, storeId, rawInput);

  return db.$transaction(async (tx) => {
    const sku = await tx.storeSku.findUnique({
      where: { storeId_id: { storeId, id: skuId } },
      select: { id: true, storeId: true, storeProductId: true, code: true, isActive: true, archivedAt: true },
    });
    if (!sku || sku.storeProductId !== productId || sku.storeId !== context.storeId) {
      throw new CatalogNotFoundError("Store SKU not found.");
    }
    if (!sku.isActive) throw new CatalogConflictError("SKU is already archived.");

    const activeSiblingCount = await tx.storeSku.count({
      where: { storeId, storeProductId: productId, isActive: true, id: { not: skuId } },
    });
    if (activeSiblingCount === 0) {
      throw new CatalogConflictError("A product must keep at least one active SKU.");
    }

    const archivedAt = new Date();
    const after = await tx.storeSku.update({
      where: { storeId_id: { storeId, id: skuId } },
      data: { isActive: false, archivedAt },
      select: { id: true, storeId: true, storeProductId: true, code: true, isActive: true, archivedAt: true },
    });

    await tx.auditLog.create({
      data: {
        storeId,
        actorId: context.actor.id,
        action: "CATALOG_STORE_SKU_ARCHIVED",
        targetType: "StoreSku",
        targetId: skuId,
        reason: input.reason,
        before: { code: sku.code, isActive: sku.isActive, archivedAt: sku.archivedAt },
        after: { code: after.code, isActive: after.isActive, archivedAt: after.archivedAt },
      },
    });

    return after;
  });
}

export async function updateStoreSku(
  db: PrismaClient,
  context: StoreContext,
  storeId: string,
  productId: string,
  skuId: string,
  rawInput: UpdateStoreSkuInput,
) {
  const input = assertUpdateStoreSku(context, storeId, rawInput);
  const expectedUpdatedAt = new Date(input.expectedUpdatedAt);

  return db.$transaction(async (tx) => {
    const before = await tx.storeSku.findUnique({
      where: { storeId_id: { storeId, id: skuId } },
      select: {
        id: true,
        storeId: true,
        storeProductId: true,
        code: true,
        isActive: true,
        quantityInBaseUnit: true,
        currentConversionVersion: true,
        sellingPriceMinor: true,
        updatedAt: true,
      },
    });
    if (!before || before.storeId !== context.storeId || before.storeProductId !== productId) {
      throw new CatalogNotFoundError("Store SKU not found.");
    }
    if (!before.isActive) throw new CatalogConflictError("Archived SKUs cannot be updated.");

    const quantityChanged = input.quantityInBaseUnit !== undefined
      && !new Prisma.Decimal(input.quantityInBaseUnit).equals(before.quantityInBaseUnit);
    const priceChanged = input.sellingPriceMinor !== undefined
      && BigInt(input.sellingPriceMinor) !== before.sellingPriceMinor;
    if (!quantityChanged && !priceChanged) {
      throw new CatalogConflictError("Price and conversion are unchanged.");
    }

    const changedAt = new Date();
    const nextConversionVersion = before.currentConversionVersion + (quantityChanged ? 1 : 0);
    const updateResult = await tx.storeSku.updateMany({
      where: {
        storeId,
        id: skuId,
        storeProductId: productId,
        isActive: true,
        updatedAt: expectedUpdatedAt,
      },
      data: {
        ...(quantityChanged ? { quantityInBaseUnit: input.quantityInBaseUnit } : {}),
        ...(quantityChanged ? { currentConversionVersion: nextConversionVersion } : {}),
        ...(priceChanged ? { sellingPriceMinor: BigInt(input.sellingPriceMinor!) } : {}),
      },
    });
    if (updateResult.count !== 1) {
      throw new CatalogConflictError("SKU changed in another session. Refresh before retrying.");
    }

    if (quantityChanged) {
      const closedVersion = await tx.storeSkuConversionVersion.updateMany({
        where: {
          storeId,
          storeSkuId: skuId,
          version: before.currentConversionVersion,
          effectiveTo: null,
        },
        data: { effectiveTo: changedAt },
      });
      if (closedVersion.count !== 1) {
        throw new CatalogConflictError("Current SKU conversion history is inconsistent.");
      }
      await tx.storeSkuConversionVersion.create({
        data: {
          storeId,
          storeSkuId: skuId,
          version: nextConversionVersion,
          quantityInBaseUnit: input.quantityInBaseUnit!,
          effectiveFrom: changedAt,
          reason: input.reason,
          actorId: context.actor.id,
        },
      });
    }

    const after = await tx.storeSku.findUnique({
      where: { storeId_id: { storeId, id: skuId } },
      select: {
        id: true,
        storeId: true,
        storeProductId: true,
        code: true,
        quantityInBaseUnit: true,
        currentConversionVersion: true,
        sellingPriceMinor: true,
        updatedAt: true,
      },
    });
    if (!after) throw new CatalogNotFoundError("Updated Store SKU not found.");

    await tx.auditLog.create({
      data: {
        storeId,
        actorId: context.actor.id,
        action: "CATALOG_STORE_SKU_PRICE_CONVERSION_UPDATED",
        targetType: "StoreSku",
        targetId: skuId,
        reason: input.reason,
        before: {
          code: before.code,
          quantityInBaseUnit: String(before.quantityInBaseUnit),
          currentConversionVersion: before.currentConversionVersion,
          sellingPriceMinor: before.sellingPriceMinor.toString(),
          updatedAt: before.updatedAt.toISOString(),
        },
        after: {
          code: after.code,
          quantityInBaseUnit: String(after.quantityInBaseUnit),
          currentConversionVersion: after.currentConversionVersion,
          sellingPriceMinor: after.sellingPriceMinor.toString(),
          updatedAt: after.updatedAt.toISOString(),
        },
      },
    });

    return {
      ...after,
      quantityInBaseUnit: String(after.quantityInBaseUnit),
      sellingPriceMinor: after.sellingPriceMinor.toString(),
      updatedAt: after.updatedAt.toISOString(),
    };
  });
}
