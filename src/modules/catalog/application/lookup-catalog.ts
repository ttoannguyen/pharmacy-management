import {
  normalizeBarcode,
  type GlobalCatalogItem,
  type GlobalCatalogRepository,
  type StoreCatalogItem,
  type StoreCatalogRepository,
} from "./catalog-repositories";

export type CatalogLookupResult =
  | {
      kind: "LOCAL_MATCH";
      rawBarcode: string;
      normalizedBarcode: string;
      item: StoreCatalogItem;
    }
  | {
      kind: "GLOBAL_MATCHES";
      rawBarcode: string;
      normalizedBarcode: string;
      items: GlobalCatalogItem[];
    }
  | {
      kind: "NOT_FOUND";
      rawBarcode: string;
      normalizedBarcode: string;
    };

export async function lookupCatalogBarcode(input: {
  storeId: string;
  rawBarcode: string;
  local: StoreCatalogRepository;
  global: GlobalCatalogRepository;
}): Promise<CatalogLookupResult> {
  const normalizedBarcode = normalizeBarcode(input.rawBarcode);

  if (!normalizedBarcode) {
    return { kind: "NOT_FOUND", rawBarcode: input.rawBarcode, normalizedBarcode };
  }

  const localItem = await input.local.findByBarcode(input.storeId, normalizedBarcode);
  if (localItem) {
    return { kind: "LOCAL_MATCH", rawBarcode: input.rawBarcode, normalizedBarcode, item: localItem };
  }

  const globalItems = await input.global.findVerifiedByBarcode(normalizedBarcode);
  if (globalItems.length > 0) {
    return { kind: "GLOBAL_MATCHES", rawBarcode: input.rawBarcode, normalizedBarcode, items: globalItems };
  }

  return { kind: "NOT_FOUND", rawBarcode: input.rawBarcode, normalizedBarcode };
}
