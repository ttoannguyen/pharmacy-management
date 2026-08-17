export type CatalogPage = { page: number; pageSize: number };
export type CatalogSearchOptions = { includeTotal?: boolean };

export type StoreCatalogItem = {
  id: string;
  storeId: string;
  displayName: string;
  shelfLocation: string | null;
  baseUnit: { id: string; code: string; name: string };
  skus: Array<{
    id: string;
    code: string;
    unit: { id: string; code: string; name: string };
    quantityInBaseUnit: string;
    currentConversionVersion: number;
    sellingPriceMinor: string;
    updatedAt: string;
    barcodes: string[];
  }>;
};

export type GlobalCatalogItem = {
  barcodeId: string;
  barcode: string;
  packageId: string;
  packageDescription: string;
  productId: string;
  brandName: string;
  manufacturerName: string;
  registrationNumber: string | null;
  verificationStatus: "VERIFIED";
};

export type CatalogPageResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number | null;
  hasNextPage: boolean;
};

export type StoreCatalogRepository = {
  findByBarcode(storeId: string, barcode: string): Promise<StoreCatalogItem | null>;
  search(storeId: string, query: string, page?: CatalogPage, options?: CatalogSearchOptions): Promise<CatalogPageResult<StoreCatalogItem>>;
};

export type StoreProductDetail = StoreCatalogItem & {
  updatedAt: string;
  minimumStockBase: string;
  basedOnGlobalVersion: number | null;
  overrides: Record<string, unknown> | null;
  isActive: boolean;
  registeredProduct: {
    id: string;
    brandName: string;
    registrationNumber: string | null;
    currentVersion: number;
    verificationStatus: string;
    manufacturer: { displayName: string };
  } | null;
};

export type GlobalCatalogRepository = {
  findVerifiedByBarcode(barcode: string): Promise<GlobalCatalogItem[]>;
  searchVerified(query: string, page?: CatalogPage): Promise<CatalogPageResult<GlobalCatalogItem>>;
};

export function normalizeBarcode(input: string) {
  return input.replace(/[\s-]/g, "");
}

export function normalizeCatalogQuery(input: string) {
  return input.trim().replace(/\s+/g, " ");
}

export function normalizeExactCatalogCode(input: string) {
  return input.trim().replace(/\s+/g, "").toUpperCase();
}

export function isExactCatalogCode(input: string) {
  return /^[A-Z0-9][A-Z0-9._-]{3,79}$/i.test(input.trim());
}

export function normalizePage(page?: CatalogPage): Required<CatalogPage> {
  return {
    page: Math.max(1, Math.floor(page?.page ?? 1)),
    pageSize: Math.min(100, Math.max(1, Math.floor(page?.pageSize ?? 20))),
  };
}
