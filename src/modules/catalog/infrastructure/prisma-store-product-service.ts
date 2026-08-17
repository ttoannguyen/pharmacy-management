import { Prisma, type PrismaClient } from "@/generated/prisma/client";

import {
  assertStoreProductInput,
  assertStoreProductOverride,
  assertAddStoreSku,
  assertArchiveStoreSku,
  CatalogConflictError,
  CatalogNotFoundError,
  GlobalCatalogLinkError,
  type StoreProductInput,
  type StoreProductOverrideInput,
  type AddStoreSkuInput,
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

export async function updateStoreProductOverride(
  db: PrismaClient,
  context: StoreContext,
  storeId: string,
  productId: string,
  rawInput: StoreProductOverrideInput,
) {
  const input = assertStoreProductOverride(context, storeId, rawInput);

  return db.$transaction(async (tx) => {
    const before = await tx.storeProduct.findUnique({ where: { storeId_id: { storeId, id: productId } } });
    if (!before) throw new Error("Store product does not exist.");

    const after = await tx.storeProduct.update({
      where: { storeId_id: { storeId, id: productId } },
      data: {
        displayName: input.displayName,
        shelfLocation: input.shelfLocation,
        overrides: input.overrides as Prisma.InputJsonValue | undefined,
      },
    });

    await tx.auditLog.create({
      data: {
        storeId,
        actorId: context.actor.id,
        action: "CATALOG_STORE_PRODUCT_OVERRIDE_UPDATED",
        targetType: "StoreProduct",
        targetId: productId,
        reason: "Updated explicit store catalog override",
        before: { displayName: before.displayName, shelfLocation: before.shelfLocation, overrides: before.overrides as Prisma.InputJsonValue | undefined },
        after: { displayName: after.displayName, shelfLocation: after.shelfLocation, overrides: after.overrides as Prisma.InputJsonValue | undefined },
      },
    });

    return after;
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
      select: { id: true, storeId: true, storeProductId: true, code: true, productPackageId: true, unitId: true, quantityInBaseUnit: true, sellingPriceMinor: true },
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
          sellingPriceMinor: sku.sellingPriceMinor.toString(),
          barcode: normalizedBarcode || null,
        },
      },
    });

    return { ...sku, quantityInBaseUnit: String(sku.quantityInBaseUnit), sellingPriceMinor: sku.sellingPriceMinor.toString(), barcode: normalizedBarcode || null };
  });
}

export async function archiveStoreSku(
  db: PrismaClient,
  context: StoreContext,
  storeId: string,
  productId: string,
  skuId: string,
  rawInput: ArchiveStoreSkuInput = {},
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
        reason: input.reason ?? "Archived store SKU",
        before: { code: sku.code, isActive: sku.isActive, archivedAt: sku.archivedAt },
        after: { code: after.code, isActive: after.isActive, archivedAt: after.archivedAt },
      },
    });

    return after;
  });
}
