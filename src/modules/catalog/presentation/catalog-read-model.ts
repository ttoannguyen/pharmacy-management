import { prisma } from "@/lib/prisma";
import { getCatalogOverview } from "@/modules/catalog/application/catalog-overview";
import type { CatalogPage } from "@/modules/catalog/application/catalog-repositories";
import { createPrismaCatalogOverviewRepository } from "@/modules/catalog/infrastructure/prisma-catalog-overview";
import { createPrismaStoreCatalogRepository } from "@/modules/catalog/infrastructure/prisma-catalog-repositories";
import { getCurrentStoreContext } from "@/modules/identity/infrastructure/current-store-context";

export async function loadCatalogPage(query = "", page?: CatalogPage) {
  const context = await getCurrentStoreContext();
  return createPrismaStoreCatalogRepository(prisma).search(context.storeId, query, page);
}

export async function loadCatalogOverview() {
  const context = await getCurrentStoreContext();
  return getCatalogOverview(
    createPrismaCatalogOverviewRepository(prisma),
    context.storeId,
  );
}
