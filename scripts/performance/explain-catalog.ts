import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../../src/generated/prisma/client";

const environment = process.env.PERF_ENVIRONMENT;
const allowSyntheticDb = process.env.PERF_ALLOW_SYNTHETIC_DB === "1";
if (environment !== "local" || !allowSyntheticDb) throw new Error("EXPLAIN requires PERF_ENVIRONMENT=local and PERF_ALLOW_SYNTHETIC_DB=1.");
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");
const databaseHost = new URL(connectionString).hostname;
if (!['localhost', '127.0.0.1', '::1'].includes(databaseHost) && process.env.PERF_ALLOW_REMOTE !== "1") {
  throw new Error("Refusing non-local EXPLAIN target without PERF_ALLOW_REMOTE=1.");
}

const storeId = process.env.PERF_STORE_ID ?? "20000000-0000-4000-8000-000000000001";
const namespace = (process.env.PERF_FIXTURE_NAMESPACE ?? "PERF20260817").trim().toUpperCase();
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
  const report = {
    generatedAt: new Date().toISOString(),
    environment,
    databaseHost,
    dataset: `${namespace} synthetic fixture; read-only EXPLAIN`,
    queries: await Promise.all([
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
    ]),
  };
  const output = process.env.PERF_OUTPUT ?? "docs/performance/perf-2.2-explain.json";
  const { writeFile } = await import("node:fs/promises");
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await prisma.$disconnect();
}
