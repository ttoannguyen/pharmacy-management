BEGIN;

ALTER TABLE "store_skus"
ADD COLUMN "current_conversion_version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "store_skus"
ADD CONSTRAINT "store_skus_current_conversion_version_positive"
CHECK ("current_conversion_version" > 0);

CREATE TABLE "store_sku_conversion_versions" (
  "id" UUID NOT NULL,
  "store_id" UUID NOT NULL,
  "store_sku_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "quantity_in_base_unit" DECIMAL(18,6) NOT NULL,
  "effective_from" TIMESTAMPTZ(6) NOT NULL,
  "effective_to" TIMESTAMPTZ(6),
  "reason" TEXT NOT NULL,
  "actor_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "store_sku_conversion_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "store_sku_conversion_versions_version_positive" CHECK ("version" > 0),
  CONSTRAINT "store_sku_conversion_versions_quantity_positive" CHECK ("quantity_in_base_unit" > 0),
  CONSTRAINT "store_sku_conversion_versions_effective_range" CHECK (
    "effective_to" IS NULL OR "effective_to" > "effective_from"
  )
);

INSERT INTO "store_sku_conversion_versions" (
  "id",
  "store_id",
  "store_sku_id",
  "version",
  "quantity_in_base_unit",
  "effective_from",
  "reason"
)
SELECT
  gen_random_uuid(),
  "store_id",
  "id",
  1,
  "quantity_in_base_unit",
  "created_at",
  'Initial conversion backfill'
FROM "store_skus";

CREATE UNIQUE INDEX "sku_conversion_store_sku_version_key"
ON "store_sku_conversion_versions"("store_id", "store_sku_id", "version");

CREATE UNIQUE INDEX "store_sku_conversion_versions_one_current_key"
ON "store_sku_conversion_versions"("store_id", "store_sku_id")
WHERE "effective_to" IS NULL;

CREATE INDEX "sku_conversion_current_lookup_idx"
ON "store_sku_conversion_versions"("store_id", "store_sku_id", "effective_to");

CREATE INDEX "sku_conversion_actor_idx"
ON "store_sku_conversion_versions"("actor_id");

ALTER TABLE "store_sku_conversion_versions"
ADD CONSTRAINT "store_sku_conversion_versions_store_sku_tenant_fkey"
FOREIGN KEY ("store_id", "store_sku_id")
REFERENCES "store_skus"("store_id", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "store_sku_conversion_versions"
ADD CONSTRAINT "store_sku_conversion_versions_actor_id_fkey"
FOREIGN KEY ("actor_id")
REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
