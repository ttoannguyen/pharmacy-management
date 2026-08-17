-- Prisma does not currently emit these cross-tenant invariants from the
-- relation metadata, so keep them as an explicit forward-only migration.
ALTER TABLE "store_skus"
  ADD CONSTRAINT "store_skus_store_product_tenant_fkey"
  FOREIGN KEY ("store_id", "store_product_id")
  REFERENCES "store_products" ("store_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "store_barcodes"
  ADD CONSTRAINT "store_barcodes_store_sku_tenant_fkey"
  FOREIGN KEY ("store_id", "store_sku_id")
  REFERENCES "store_skus" ("store_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
