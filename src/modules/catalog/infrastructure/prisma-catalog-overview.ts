import { Prisma, type PrismaClient } from "@/generated/prisma/client";

import type {
  CatalogOverviewRepository,
} from "@/modules/catalog/application/catalog-overview";

type CatalogOverviewDatabase = Pick<PrismaClient, "storeProduct" | "$queryRaw">;

export function createPrismaCatalogOverviewRepository(
  db: CatalogOverviewDatabase,
): CatalogOverviewRepository {
  return {
    async load(storeId) {
      const [aggregateRows, recentRows] = await Promise.all([
          db.$queryRaw<Array<{ product_count: bigint; sku_count: bigint; priced_sku_count: bigint; identified_sku_count: bigint }>>(Prisma.sql`
            SELECT
              COUNT(DISTINCT p.id) FILTER (WHERE p.is_active) AS product_count,
              COUNT(s.id) FILTER (WHERE p.is_active AND s.is_active) AS sku_count,
              COUNT(s.id) FILTER (WHERE p.is_active AND s.is_active AND s.selling_price_minor > 0) AS priced_sku_count,
              COUNT(s.id) FILTER (
                WHERE p.is_active AND s.is_active AND EXISTS (
                  SELECT 1 FROM store_barcodes b
                  WHERE b.store_id = s.store_id AND b.store_sku_id = s.id
                )
              ) AS identified_sku_count
            FROM store_products p
            LEFT JOIN store_skus s
              ON s.store_id = p.store_id AND s.store_product_id = p.id
            WHERE p.store_id = ${storeId}
          `),
          db.storeProduct.findMany({
            where: { storeId, isActive: true },
            orderBy: { updatedAt: "desc" },
            take: 5,
            select: {
              id: true,
              displayName: true,
              updatedAt: true,
              _count: { select: { skus: { where: { isActive: true } } } },
            },
          }),
        ]);

      const [aggregate] = aggregateRows;
      if (!aggregate) throw new Error("Catalog overview aggregate was not returned.");

      return {
        productCount: Number(aggregate.product_count),
        skuCount: Number(aggregate.sku_count),
        pricedSkuCount: Number(aggregate.priced_sku_count),
        identifiedSkuCount: Number(aggregate.identified_sku_count),
        recentProducts: recentRows.map((row) => ({
          id: row.id,
          displayName: row.displayName,
          skuCount: row._count.skus,
          updatedAt: row.updatedAt,
        })),
      };
    },
  };
}
