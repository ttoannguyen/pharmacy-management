import { describe, expect, it } from "vitest";

import {
  evaluateCatalogExplainEvidence,
  planUsesIndex,
} from "./explain-plan-utils";

describe("catalog EXPLAIN evidence", () => {
  it("finds an index in nested PostgreSQL plans", () => {
    expect(planUsesIndex({
      "Node Type": "Nested Loop",
      Plans: [{ "Node Type": "Index Scan", "Index Name": "tenant_code_index" }],
    }, "tenant_code_index")).toBe(true);
    expect(planUsesIndex({ "Node Type": "Seq Scan" }, "tenant_code_index")).toBe(false);
  });

  it("requires the exact fixture, both tenant indexes and the free-text budget", () => {
    const result = evaluateCatalogExplainEvidence({
      actual: { products: 1000, skus: 5000, barcodes: 5000 },
      expected: { products: 1000, skus: 5000, barcodes: 5000 },
      freeTextBudgetMs: 10,
      queries: [
        { name: "exact-sku", executionTimeMs: 0.1, plan: { "Index Name": "store_skus_store_id_code_key" } },
        { name: "exact-barcode", executionTimeMs: 0.1, plan: { "Index Name": "store_barcodes_store_id_barcode_key" } },
        { name: "free-text-display-name", executionTimeMs: 2.5, plan: { "Node Type": "Seq Scan" } },
      ],
    });

    expect(result.passed).toBe(true);
    expect(Object.values(result.criteria)).not.toContain(false);
  });

  it("fails when scale, an exact index or free-text cost regresses", () => {
    const result = evaluateCatalogExplainEvidence({
      actual: { products: 999, skus: 5000, barcodes: 5000 },
      expected: { products: 1000, skus: 5000, barcodes: 5000 },
      freeTextBudgetMs: 10,
      queries: [
        { name: "exact-sku", executionTimeMs: 0.1, plan: { "Node Type": "Seq Scan" } },
        { name: "exact-barcode", executionTimeMs: 0.1, plan: { "Index Name": "store_barcodes_store_id_barcode_key" } },
        { name: "free-text-display-name", executionTimeMs: 12, plan: { "Node Type": "Seq Scan" } },
      ],
    });

    expect(result).toMatchObject({
      passed: false,
      criteria: {
        fixtureMatchesRequestedScale: false,
        exactSkuUsesTenantCodeIndex: false,
        exactBarcodeUsesTenantBarcodeIndex: true,
        freeTextWithinCurrentFixtureBudget: false,
      },
    });
  });
});
