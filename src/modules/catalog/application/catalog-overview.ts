export type CatalogOverview = {
  productCount: number;
  skuCount: number;
  pricedSkuCount: number;
  identifiedSkuCount: number;
  recentProducts: Array<{
    id: string;
    displayName: string;
    skuCount: number;
    updatedAt: Date;
  }>;
};

export type CatalogOverviewRepository = {
  load(storeId: string): Promise<CatalogOverview>;
};

export function getCatalogOverview(repository: CatalogOverviewRepository, storeId: string) {
  return repository.load(storeId);
}
