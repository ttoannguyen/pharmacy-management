import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../../src/generated/prisma/client";
import { evaluateCatalogExplainEvidence } from "./explain-plan-utils";

const environment = process.env.PERF_ENVIRONMENT;
const allowSyntheticDb = process.env.PERF_ALLOW_SYNTHETIC_DB === "1";
if (environment !== "local" || !allowSyntheticDb) throw new Error("EXPLAIN requires PERF_ENVIRONMENT=local and PERF_ALLOW_SYNTHETIC_DB=1.");
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");
const databaseUrl = new URL(connectionString);
const databaseHost = databaseUrl.hostname;
if (!['localhost', '127.0.0.1', '::1'].includes(databaseHost) && process.env.PERF_ALLOW_REMOTE !== "1") {
  throw new Error("Refusing non-local EXPLAIN target without PERF_ALLOW_REMOTE=1.");
}

const storeId = process.env.PERF_STORE_ID ?? "20000000-0000-4000-8000-000000000001";
const namespace = (process.env.PERF_FIXTURE_NAMESPACE ?? "PERF20260817").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "-");
if (!namespace || namespace.length > 32) throw new Error("PERF_FIXTURE_NAMESPACE must be 1-32 safe characters.");
const expectedProducts = Number(process.env.PERF_PRODUCT_COUNT ?? 1000);
const skusPerProduct = Number(process.env.PERF_SKUS_PER_PRODUCT ?? 5);
const freeTextBudgetMs = Number(process.env.PERF_FREE_TEXT_BUDGET_MS ?? 10);
if (!Number.isInteger(expectedProducts) || expectedProducts < 1 || expectedProducts > 5000) throw new Error("Invalid PERF_PRODUCT_COUNT.");
if (!Number.isInteger(skusPerProduct) || skusPerProduct < 1 || skusPerProduct > 10) throw new Error("Invalid PERF_SKUS_PER_PRODUCT.");
if (!Number.isFinite(freeTextBudgetMs) || freeTextBudgetMs <= 0) throw new Error("PERF_FREE_TEXT_BUDGET_MS must be positive.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

type ExplainRow = { "QUERY PLAN": Array<{ Plan: Record<string, unknown>; "Execution Time"?: number; "Planning Time"?: number }> };

async function explain(name: string, query: Prisma.Sql) {
  const rows = await prisma.$queryRaw<ExplainRow[]>(query);
  const root = rows[0]?.["QUERY PLAN"]?.[0];
  return {
    name,
    planningTimeMs: root?.["Planning Time"] ?? null,
    executionTimeMs: root?.["Execution Time"] ?? null,
    plan: root?.Plan ?? null,
  };
}

try {
  const [products, skus, barcodes] = await Promise.all([
    prisma.storeProduct.count({ where: { storeId, displayName: { startsWith: `${namespace} PERF PRODUCT ` } } }),
    prisma.storeSku.count({ where: { storeId, code: { startsWith: `${namespace}-SKU-` } } }),
    prisma.storeBarcode.count({ where: { storeId, barcode: { startsWith: `${namespace}-BC-` } } }),
  ]);
  const fixtureCounts = { products, skus, barcodes };
  const expectedFixtureCounts = {
    products: expectedProducts,
    skus: expectedProducts * skusPerProduct,
    barcodes: expectedProducts * skusPerProduct,
  };
  const queries = await Promise.all([
    explain("exact-sku", Prisma.sql`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT id FROM store_skus
      WHERE store_id = ${storeId} AND is_active = true AND code = ${`${namespace}-SKU-0001-1`}
    `),
    explain("exact-barcode", Prisma.sql`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT id FROM store_barcodes
      WHERE store_id = ${storeId} AND barcode = ${`${namespace}-BC-0001-1`}
    `),
    explain("free-text-display-name", Prisma.sql`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT id FROM store_products
      WHERE store_id = ${storeId} AND is_active = true
        AND display_name ILIKE ${`%${namespace} PERF PRODUCT 00%`}
    `),
  ]);
  const evaluation = evaluateCatalogExplainEvidence({
    queries,
    actual: fixtureCounts,
    expected: expectedFixtureCounts,
    freeTextBudgetMs,
  });
  const report = {
    generatedAt: new Date().toISOString(),
    environment,
    databaseHost,
    databasePort: databaseUrl.port || "5432",
    commit: process.env.PERF_COMMIT ?? process.env.GITHUB_SHA ?? "working-tree",
    dataset: `${namespace} synthetic fixture; read-only EXPLAIN`,
    fixtureCounts,
    expectedFixtureCounts,
    freeTextBudgetMs,
    queries,
    criteria: evaluation.criteria,
    decision: {
      addPgTrgmIndexNow: false,
      reason: `Free-text execution must stay within ${freeTextBudgetMs}ms on the current fixture; exact paths must retain tenant composite indexes.`,
      revisitWhen: "Versioned fixture reaches 100000 store products or catalog free-text p95 exceeds its warm-read budget.",
    },
  };
  const output = process.env.PERF_OUTPUT ?? "docs/performance/perf-2.2-explain-local.json";
  const { writeFile } = await import("node:fs/promises");
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (!evaluation.passed) {
    const failed = Object.entries(evaluation.criteria).filter(([, passed]) => !passed).map(([name]) => name);
    throw new Error(`Catalog EXPLAIN criteria failed: ${failed.join(", ")}.`);
  }
} finally {
  await prisma.$disconnect();
}
