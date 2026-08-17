-- DropForeignKey
ALTER TABLE "store_barcodes" DROP CONSTRAINT "store_barcodes_store_sku_id_fkey";

-- DropForeignKey
ALTER TABLE "store_skus" DROP CONSTRAINT "store_skus_store_product_id_fkey";

-- AddForeignKey
ALTER TABLE "store_skus" ADD CONSTRAINT "store_skus_store_id_store_product_id_fkey" FOREIGN KEY ("store_id", "store_product_id") REFERENCES "store_products"("store_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_barcodes" ADD CONSTRAINT "store_barcodes_store_id_store_sku_id_fkey" FOREIGN KEY ("store_id", "store_sku_id") REFERENCES "store_skus"("store_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
