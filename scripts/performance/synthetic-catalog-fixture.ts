import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";

const environment = process.env.PERF_ENVIRONMENT;
const allowSyntheticDb = process.env.PERF_ALLOW_SYNTHETIC_DB === "1";
if (environment !== "local" || !allowSyntheticDb) {
  throw new Error("Synthetic fixture requires PERF_ENVIRONMENT=local and PERF_ALLOW_SYNTHETIC_DB=1.");
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for the synthetic fixture.");
const databaseHost = new URL(connectionString).hostname;
if (!['localhost', '127.0.0.1', '::1'].includes(databaseHost) && process.env.PERF_ALLOW_REMOTE !== "1") {
  throw new Error("Refusing a non-local database. Set PERF_ALLOW_REMOTE=1 only after approving the synthetic target and cleanup plan.");
}

const namespace = (process.env.PERF_FIXTURE_NAMESPACE ?? "perf-local").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "-");
if (!namespace || namespace.length > 32) throw new Error("PERF_FIXTURE_NAMESPACE must be 1-32 safe characters.");

const storeId = process.env.PERF_STORE_ID ?? "20000000-0000-4000-8000-000000000001";
const productCount = Number(process.env.PERF_PRODUCT_COUNT ?? 1000);
const skusPerProduct = Number(process.env.PERF_SKUS_PER_PRODUCT ?? 5);
if (!Number.isInteger(productCount) || productCount < 1 || productCount > 5000) throw new Error("Invalid PERF_PRODUCT_COUNT.");
if (!Number.isInteger(skusPerProduct) || skusPerProduct < 1 || skusPerProduct > 10) throw new Error("Invalid PERF_SKUS_PER_PRODUCT.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function cleanup() {
  // Keep cleanup idempotent and outside the default 5s interactive transaction
  // timeout; a large synthetic namespace may take longer over a remote pooler.
  await prisma.storeBarcode.deleteMany({ where: { storeId, barcode: { startsWith: `${namespace}-BC-` } } });
  await prisma.storeSkuConversionVersion.deleteMany({
    where: { storeId, storeSku: { code: { startsWith: `${namespace}-SKU-` } } },
  });
  await prisma.storeSku.deleteMany({ where: { storeId, code: { startsWith: `${namespace}-SKU-` } } });
  await prisma.storeProduct.deleteMany({ where: { storeId, displayName: { startsWith: `${namespace} PERF PRODUCT ` } } });
}

async function load() {
  const unit = await prisma.unit.findUnique({ where: { code: "TABLET" }, select: { id: true } });
  if (!unit) throw new Error("TABLET unit is missing; run the deterministic seed first.");
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { id: true } });
  if (!store) throw new Error("PERF_STORE_ID does not identify an existing store.");

  await cleanup();
  const products = Array.from({ length: productCount }, (_, index) => ({
    id: crypto.randomUUID(),
    storeId,
    baseUnitId: unit.id,
    displayName: `${namespace} PERF PRODUCT ${String(index + 1).padStart(4, "0")}`,
    minimumStockBase: 0,
  }));
  await prisma.storeProduct.createMany({ data: products });

  const skus = products.flatMap((product, productIndex) => Array.from({ length: skusPerProduct }, (_, skuIndex) => ({
    id: crypto.randomUUID(),
    storeId,
    storeProductId: product.id,
    unitId: unit.id,
    code: `${namespace}-SKU-${String(productIndex + 1).padStart(4, "0")}-${skuIndex + 1}`,
    quantityInBaseUnit: 1,
    sellingPriceMinor: BigInt(1000 + skuIndex),
  })));
  await prisma.storeSku.createMany({ data: skus });
  const effectiveFrom = new Date();
  await prisma.storeSkuConversionVersion.createMany({
    data: skus.map((sku) => ({
      id: crypto.randomUUID(),
      storeId,
      storeSkuId: sku.id,
      version: 1,
      quantityInBaseUnit: sku.quantityInBaseUnit,
      effectiveFrom,
      reason: "Synthetic performance fixture conversion",
    })),
  });
  await prisma.storeBarcode.createMany({
    data: skus.map((sku) => ({ storeId, storeSkuId: sku.id, barcode: `${namespace}-BC-${sku.code.slice(namespace.length + 5)}` })),
  });

  console.info(JSON.stringify({ namespace, storeId, products: products.length, skus: skus.length, conversionVersions: skus.length, barcodes: skus.length, action: "loaded" }));
}

try {
  const action = process.argv[2] ?? "load";
  if (action === "cleanup") {
    await cleanup();
    console.info(JSON.stringify({ namespace, storeId, action: "cleaned" }));
  } else if (action === "load") {
    await load();
  } else {
    throw new Error("Usage: synthetic-catalog-fixture.ts [load|cleanup]");
  }
} finally {
  await prisma.$disconnect();
}
