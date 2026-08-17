import type { PrismaClient, VerificationStatus } from "@/generated/prisma/client";

import {
  normalizeBarcode,
  normalizeCatalogQuery,
  normalizeExactCatalogCode,
  normalizePage,
  isExactCatalogCode,
  type CatalogPage,
  type CatalogPageResult,
  type CatalogSearchOptions,
  type GlobalCatalogItem,
  type GlobalCatalogRepository,
  type StoreCatalogItem,
  type StoreProductDetail,
  type StoreCatalogRepository,
} from "@/modules/catalog/application/catalog-repositories";

type CatalogDatabase = Pick<PrismaClient, "storeProduct" | "storeBarcode" | "globalBarcode">;

const storeProductSelect = {
  id: true,
  storeId: true,
  displayName: true,
  shelfLocation: true,
  baseUnit: { select: { id: true, code: true, name: true } },
  skus: {
    where: { isActive: true },
    select: {
      id: true,
      code: true,
      unit: { select: { id: true, code: true, name: true } },
      quantityInBaseUnit: true,
      currentConversionVersion: true,
      sellingPriceMinor: true,
      updatedAt: true,
      barcodes: { select: { barcode: true } },
    },
  },
} as const;

function mapStoreProduct(product: {
  id: string;
  storeId: string;
  displayName: string;
  shelfLocation: string | null;
  baseUnit: { id: string; code: string; name: string };
  skus: Array<{
    id: string;
    code: string;
    unit: { id: string; code: string; name: string };
    quantityInBaseUnit: unknown;
    currentConversionVersion: number;
    sellingPriceMinor: bigint;
    updatedAt: Date;
    barcodes: Array<{ barcode: string }>;
  }>;
}): StoreCatalogItem {
  return {
    ...product,
    skus: product.skus.map((sku) => ({
      ...sku,
      quantityInBaseUnit: String(sku.quantityInBaseUnit),
      sellingPriceMinor: sku.sellingPriceMinor.toString(),
      updatedAt: sku.updatedAt.toISOString(),
      barcodes: sku.barcodes.map(({ barcode }) => barcode),
    })),
  };
}

function pageResult<T>(items: T[], total: number | null, hasNextPage: boolean, page: Required<CatalogPage>): CatalogPageResult<T> {
  return { items, page: page.page, pageSize: page.pageSize, total, hasNextPage };
}

export function createPrismaStoreCatalogRepository(db: CatalogDatabase): StoreCatalogRepository {
  return {
    async findByBarcode(storeId, rawBarcode) {
      const barcode = normalizeBarcode(rawBarcode);
      const match = await db.storeBarcode.findFirst({
        where: { storeId, barcode, storeSku: { isActive: true, storeProduct: { isActive: true } } },
        select: { storeSku: { select: { storeProduct: { select: storeProductSelect } } } },
      });
      return match ? mapStoreProduct(match.storeSku.storeProduct) : null;
    },

    async search(storeId, rawQuery, requestedPage, options: CatalogSearchOptions = {}) {
      const query = normalizeCatalogQuery(rawQuery);
      const page = normalizePage(requestedPage);
      const exactCode = isExactCatalogCode(query) ? normalizeExactCatalogCode(query) : null;
      const exactBarcode = exactCode && /^\d{6,}$/.test(normalizeBarcode(exactCode)) ? normalizeBarcode(exactCode) : null;
      const where = {
        storeId,
        isActive: true,
        ...(query ? {
          OR: [
            { displayName: { contains: query, mode: "insensitive" as const } },
            ...(exactCode ? [{ skus: { some: { isActive: true, code: exactCode } } }] : [{ skus: { some: { isActive: true, code: { contains: query, mode: "insensitive" as const } } } }]),
            ...(exactBarcode ? [{ skus: { some: { isActive: true, barcodes: { some: { barcode: exactBarcode } } } } }] : [{ skus: { some: { isActive: true, barcodes: { some: { barcode: { contains: query, mode: "insensitive" as const } } } } } }]),
            { registeredProduct: { brandName: { contains: query, mode: "insensitive" as const } } },
            { registeredProduct: { registrationNumber: { contains: query, mode: "insensitive" as const } } },
          ],
        } : {}),
      };
      const items = await db.storeProduct.findMany({ where, select: storeProductSelect, orderBy: { displayName: "asc" }, skip: (page.page - 1) * page.pageSize, take: page.pageSize + 1 });
      const hasNextPage = items.length > page.pageSize;
      const visibleItems = items.slice(0, page.pageSize);
      const total = options.includeTotal ? await db.storeProduct.count({ where }) : null;
      return pageResult(visibleItems.map(mapStoreProduct), total, hasNextPage, page);
    },
  };
}

const storeProductDetailSelect = {
  ...storeProductSelect,
  updatedAt: true,
  minimumStockBase: true,
  basedOnGlobalVersion: true,
  overrides: true,
  isActive: true,
  registeredProduct: {
    select: {
      id: true,
      brandName: true,
      registrationNumber: true,
      currentVersion: true,
      verificationStatus: true,
      manufacturer: { select: { displayName: true } },
    },
  },
} as const;

export type StoreProductDetailDatabase = Pick<PrismaClient, "storeProduct">;

export function createPrismaStoreProductDetailRepository(db: StoreProductDetailDatabase) {
  return {
    async findById(storeId: string, productId: string): Promise<StoreProductDetail | null> {
      const product = await db.storeProduct.findFirst({
        where: { storeId, id: productId },
        select: storeProductDetailSelect,
      });
      if (!product) return null;
      return {
        ...mapStoreProduct(product),
        updatedAt: product.updatedAt.toISOString(),
        minimumStockBase: String(product.minimumStockBase),
        basedOnGlobalVersion: product.basedOnGlobalVersion,
        overrides: product.overrides && typeof product.overrides === "object" && !Array.isArray(product.overrides)
          ? product.overrides as Record<string, unknown>
          : null,
        isActive: product.isActive,
        registeredProduct: product.registeredProduct,
      };
    },
  };
}

const globalBarcodeSelect = {
  id: true,
  barcode: true,
  productPackage: {
    select: {
      id: true,
      description: true,
      verificationStatus: true,
      registeredProduct: {
        select: {
          id: true,
          brandName: true,
          registrationNumber: true,
          verificationStatus: true,
          manufacturer: { select: { displayName: true } },
        },
      },
    },
  },
} as const;

function mapGlobalBarcode(row: {
  id: string;
  barcode: string;
  productPackage: {
    id: string;
    description: string;
    verificationStatus: VerificationStatus;
    registeredProduct: {
      id: string;
      brandName: string;
      registrationNumber: string | null;
      verificationStatus: VerificationStatus;
      manufacturer: { displayName: string };
    };
  };
}): GlobalCatalogItem {
  return {
    barcodeId: row.id,
    barcode: row.barcode,
    packageId: row.productPackage.id,
    packageDescription: row.productPackage.description,
    productId: row.productPackage.registeredProduct.id,
    brandName: row.productPackage.registeredProduct.brandName,
    manufacturerName: row.productPackage.registeredProduct.manufacturer.displayName,
    registrationNumber: row.productPackage.registeredProduct.registrationNumber,
    verificationStatus: "VERIFIED",
  };
}

export function createPrismaGlobalCatalogRepository(db: CatalogDatabase): GlobalCatalogRepository {
  return {
    async findVerifiedByBarcode(rawBarcode) {
      const barcode = normalizeBarcode(rawBarcode);
      const rows = await db.globalBarcode.findMany({
        where: {
          barcode,
          verificationStatus: "VERIFIED",
          productPackage: { verificationStatus: "VERIFIED", registeredProduct: { verificationStatus: "VERIFIED" } },
        },
        select: globalBarcodeSelect,
      });
      return rows.map(mapGlobalBarcode);
    },

    async searchVerified(rawQuery, requestedPage) {
      const query = normalizeCatalogQuery(rawQuery);
      const page = normalizePage(requestedPage);
      const where = {
        verificationStatus: "VERIFIED" as const,
        productPackage: {
          verificationStatus: "VERIFIED" as const,
          registeredProduct: {
            verificationStatus: "VERIFIED" as const,
            ...(query ? {
              OR: [
                { brandName: { contains: query, mode: "insensitive" as const } },
                { registrationNumber: { contains: query, mode: "insensitive" as const } },
                { manufacturer: { displayName: { contains: query, mode: "insensitive" as const } } },
                { concept: { normalizedName: { contains: query, mode: "insensitive" as const } } },
              ],
            } : {}),
          },
        },
      };
      const [rows, total] = await Promise.all([
        db.globalBarcode.findMany({ where, select: globalBarcodeSelect, orderBy: { barcode: "asc" }, skip: (page.page - 1) * page.pageSize, take: page.pageSize }),
        db.globalBarcode.count({ where }),
      ]);
      return pageResult(rows.map(mapGlobalBarcode), total, page.page * page.pageSize < total, page);
    },
  };
}
