import { prisma } from "@/lib/prisma";
import { createPrismaStoreProductDetailRepository } from "@/modules/catalog/infrastructure/prisma-catalog-repositories";
import { getCurrentStoreContext } from "@/modules/identity/infrastructure/current-store-context";

export async function loadCatalogProductDetail(productId: string) {
  const context = await getCurrentStoreContext();
  const detail = await createPrismaStoreProductDetailRepository(prisma).findById(context.storeId, productId);
  return { context, detail };
}
