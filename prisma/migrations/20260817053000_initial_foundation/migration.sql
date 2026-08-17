-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'PHARMACIST', 'CLINICIAN', 'INVENTORY_STAFF', 'ACCOUNTANT', 'SYSTEM_ADMIN');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CatalogSource" AS ENUM ('NATIONAL_DRUG_DATABASE', 'DRUG_ADMINISTRATION', 'SUPPLIER', 'STORE_SUBMISSION', 'OCR', 'MANUAL', 'SYNTHETIC_DEMO');

-- CreateEnum
CREATE TYPE "CatalogSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'MERGED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "external_auth_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" UUID NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drug_concepts" (
    "id" UUID NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "dosage_form" TEXT NOT NULL,
    "route" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "drug_concepts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drug_concept_ingredients" (
    "concept_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "strength_value" DECIMAL(18,6),
    "strength_unit" TEXT,

    CONSTRAINT "drug_concept_ingredients_pkey" PRIMARY KEY ("concept_id","ingredient_id")
);

-- CreateTable
CREATE TABLE "manufacturers" (
    "id" UUID NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "country_code" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "manufacturers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registered_products" (
    "id" UUID NOT NULL,
    "concept_id" UUID NOT NULL,
    "manufacturer_id" UUID NOT NULL,
    "official_id" TEXT,
    "registration_number" TEXT,
    "brand_name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "source" "CatalogSource" NOT NULL,
    "source_reference" TEXT,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "registered_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registered_product_versions" (
    "id" UUID NOT NULL,
    "registered_product_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "source" "CatalogSource" NOT NULL,
    "source_reference" TEXT,
    "valid_from" TIMESTAMPTZ(6) NOT NULL,
    "valid_to" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registered_product_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_packages" (
    "id" UUID NOT NULL,
    "registered_product_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "package_quantity" DECIMAL(18,6),
    "package_unit" TEXT,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "product_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_barcodes" (
    "id" UUID NOT NULL,
    "product_package_id" UUID NOT NULL,
    "barcode" TEXT NOT NULL,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "valid_from" TIMESTAMPTZ(6),
    "valid_to" TIMESTAMPTZ(6),
    "source" "CatalogSource" NOT NULL,
    "source_reference" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "global_barcodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_products" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "registered_product_id" UUID,
    "base_unit_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "shelf_location" TEXT,
    "minimum_stock_base" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "based_on_global_version" INTEGER,
    "overrides" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "store_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_skus" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "store_product_id" UUID NOT NULL,
    "product_package_id" UUID,
    "unit_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "quantity_in_base_unit" DECIMAL(18,6) NOT NULL,
    "selling_price_minor" BIGINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "store_skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_barcodes" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "store_sku_id" UUID NOT NULL,
    "barcode" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_barcodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_submissions" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "submitted_by_id" UUID NOT NULL,
    "reviewed_by_id" UUID,
    "barcode" TEXT,
    "proposed_data" JSONB NOT NULL,
    "evidence" JSONB,
    "status" "CatalogSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "review_note" TEXT,
    "resolved_product_id" UUID,
    "resolved_package_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(6),

    CONSTRAINT "catalog_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "store_id" UUID,
    "actor_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "reason" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_external_auth_id_key" ON "users"("external_auth_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "stores_code_key" ON "stores"("code");

-- CreateIndex
CREATE INDEX "memberships_store_id_role_idx" ON "memberships"("store_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_user_id_store_id_key" ON "memberships"("user_id", "store_id");

-- CreateIndex
CREATE UNIQUE INDEX "units_code_key" ON "units"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_normalized_name_key" ON "ingredients"("normalized_name");

-- CreateIndex
CREATE INDEX "drug_concepts_normalized_name_idx" ON "drug_concepts"("normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "manufacturers_normalized_name_country_code_key" ON "manufacturers"("normalized_name", "country_code");

-- CreateIndex
CREATE UNIQUE INDEX "registered_products_official_id_key" ON "registered_products"("official_id");

-- CreateIndex
CREATE UNIQUE INDEX "registered_products_registration_number_key" ON "registered_products"("registration_number");

-- CreateIndex
CREATE INDEX "registered_products_brand_name_idx" ON "registered_products"("brand_name");

-- CreateIndex
CREATE INDEX "registered_products_concept_id_manufacturer_id_idx" ON "registered_products"("concept_id", "manufacturer_id");

-- CreateIndex
CREATE UNIQUE INDEX "registered_product_versions_registered_product_id_version_key" ON "registered_product_versions"("registered_product_id", "version");

-- CreateIndex
CREATE INDEX "product_packages_registered_product_id_idx" ON "product_packages"("registered_product_id");

-- CreateIndex
CREATE INDEX "global_barcodes_barcode_verification_status_idx" ON "global_barcodes"("barcode", "verification_status");

-- CreateIndex
CREATE UNIQUE INDEX "global_barcodes_product_package_id_barcode_key" ON "global_barcodes"("product_package_id", "barcode");

-- CreateIndex
CREATE INDEX "store_products_store_id_display_name_idx" ON "store_products"("store_id", "display_name");

-- CreateIndex
CREATE INDEX "store_products_store_id_registered_product_id_idx" ON "store_products"("store_id", "registered_product_id");

-- CreateIndex
CREATE INDEX "store_skus_store_id_store_product_id_idx" ON "store_skus"("store_id", "store_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "store_skus_store_id_code_key" ON "store_skus"("store_id", "code");

-- CreateIndex
CREATE INDEX "store_barcodes_store_id_store_sku_id_idx" ON "store_barcodes"("store_id", "store_sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "store_barcodes_store_id_barcode_key" ON "store_barcodes"("store_id", "barcode");

-- Tenant-safe composite keys used by child-table foreign keys.
CREATE UNIQUE INDEX "store_products_store_id_id_key" ON "store_products"("store_id", "id");

CREATE UNIQUE INDEX "store_skus_store_id_id_key" ON "store_skus"("store_id", "id");

-- CreateIndex
CREATE INDEX "catalog_submissions_store_id_status_idx" ON "catalog_submissions"("store_id", "status");

-- CreateIndex
CREATE INDEX "catalog_submissions_barcode_idx" ON "catalog_submissions"("barcode");

-- CreateIndex
CREATE INDEX "audit_logs_store_id_created_at_idx" ON "audit_logs"("store_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_idx" ON "audit_logs"("target_type", "target_id");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drug_concept_ingredients" ADD CONSTRAINT "drug_concept_ingredients_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "drug_concepts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drug_concept_ingredients" ADD CONSTRAINT "drug_concept_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registered_products" ADD CONSTRAINT "registered_products_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "drug_concepts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registered_products" ADD CONSTRAINT "registered_products_manufacturer_id_fkey" FOREIGN KEY ("manufacturer_id") REFERENCES "manufacturers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registered_product_versions" ADD CONSTRAINT "registered_product_versions_registered_product_id_fkey" FOREIGN KEY ("registered_product_id") REFERENCES "registered_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_packages" ADD CONSTRAINT "product_packages_registered_product_id_fkey" FOREIGN KEY ("registered_product_id") REFERENCES "registered_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "global_barcodes" ADD CONSTRAINT "global_barcodes_product_package_id_fkey" FOREIGN KEY ("product_package_id") REFERENCES "product_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_registered_product_id_fkey" FOREIGN KEY ("registered_product_id") REFERENCES "registered_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_base_unit_id_fkey" FOREIGN KEY ("base_unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_skus" ADD CONSTRAINT "store_skus_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_skus" ADD CONSTRAINT "store_skus_store_product_id_fkey" FOREIGN KEY ("store_product_id") REFERENCES "store_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A SKU and its product must belong to the same store.
ALTER TABLE "store_skus" ADD CONSTRAINT "store_skus_store_product_tenant_fkey" FOREIGN KEY ("store_id", "store_product_id") REFERENCES "store_products"("store_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_skus" ADD CONSTRAINT "store_skus_product_package_id_fkey" FOREIGN KEY ("product_package_id") REFERENCES "product_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_skus" ADD CONSTRAINT "store_skus_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_barcodes" ADD CONSTRAINT "store_barcodes_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_barcodes" ADD CONSTRAINT "store_barcodes_store_sku_id_fkey" FOREIGN KEY ("store_sku_id") REFERENCES "store_skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A barcode and its SKU must belong to the same store.
ALTER TABLE "store_barcodes" ADD CONSTRAINT "store_barcodes_store_sku_tenant_fkey" FOREIGN KEY ("store_id", "store_sku_id") REFERENCES "store_skus"("store_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_submissions" ADD CONSTRAINT "catalog_submissions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_submissions" ADD CONSTRAINT "catalog_submissions_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_submissions" ADD CONSTRAINT "catalog_submissions_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain invariants that Prisma cannot currently express in the schema DSL.
ALTER TABLE "drug_concept_ingredients" ADD CONSTRAINT "drug_concept_ingredients_strength_positive" CHECK ("strength_value" IS NULL OR "strength_value" > 0);
ALTER TABLE "registered_products" ADD CONSTRAINT "registered_products_current_version_positive" CHECK ("current_version" > 0);
ALTER TABLE "registered_product_versions" ADD CONSTRAINT "registered_product_versions_version_positive" CHECK ("version" > 0);
ALTER TABLE "registered_product_versions" ADD CONSTRAINT "registered_product_versions_valid_range" CHECK ("valid_to" IS NULL OR "valid_to" > "valid_from");
ALTER TABLE "product_packages" ADD CONSTRAINT "product_packages_quantity_positive" CHECK ("package_quantity" IS NULL OR "package_quantity" > 0);
ALTER TABLE "global_barcodes" ADD CONSTRAINT "global_barcodes_valid_range" CHECK ("valid_to" IS NULL OR "valid_from" IS NULL OR "valid_to" > "valid_from");
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_minimum_stock_nonnegative" CHECK ("minimum_stock_base" >= 0);
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_global_version_positive" CHECK ("based_on_global_version" IS NULL OR "based_on_global_version" > 0);
ALTER TABLE "store_skus" ADD CONSTRAINT "store_skus_conversion_positive" CHECK ("quantity_in_base_unit" > 0);
ALTER TABLE "store_skus" ADD CONSTRAINT "store_skus_selling_price_nonnegative" CHECK ("selling_price_minor" >= 0);
