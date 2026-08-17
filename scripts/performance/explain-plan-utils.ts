export type ExplainPlan = Record<string, unknown>;

export type CatalogExplainQuery = {
  name: string;
  executionTimeMs: number | null;
  plan: ExplainPlan | null;
};

export type CatalogFixtureCounts = {
  products: number;
  skus: number;
  barcodes: number;
};

function childPlans(plan: ExplainPlan): ExplainPlan[] {
  const children = plan.Plans;
  return Array.isArray(children)
    ? children.filter((child): child is ExplainPlan => Boolean(child) && typeof child === "object" && !Array.isArray(child))
    : [];
}

export function planUsesIndex(plan: ExplainPlan | null, indexName: string): boolean {
  if (!plan) return false;
  if (plan["Index Name"] === indexName) return true;
  return childPlans(plan).some((child) => planUsesIndex(child, indexName));
}

export function evaluateCatalogExplainEvidence(input: {
  queries: CatalogExplainQuery[];
  actual: CatalogFixtureCounts;
  expected: CatalogFixtureCounts;
  freeTextBudgetMs: number;
}) {
  const byName = new Map(input.queries.map((query) => [query.name, query]));
  const exactSku = byName.get("exact-sku");
  const exactBarcode = byName.get("exact-barcode");
  const freeText = byName.get("free-text-display-name");
  const freeTextExecutionMs = freeText?.executionTimeMs;

  const criteria = {
    fixtureMatchesRequestedScale:
      input.actual.products === input.expected.products
      && input.actual.skus === input.expected.skus
      && input.actual.barcodes === input.expected.barcodes,
    exactSkuUsesTenantCodeIndex: planUsesIndex(exactSku?.plan ?? null, "store_skus_store_id_code_key"),
    exactBarcodeUsesTenantBarcodeIndex: planUsesIndex(exactBarcode?.plan ?? null, "store_barcodes_store_id_barcode_key"),
    freeTextWithinCurrentFixtureBudget:
      typeof freeTextExecutionMs === "number"
      && freeTextExecutionMs <= input.freeTextBudgetMs,
  };

  return {
    criteria,
    passed: Object.values(criteria).every(Boolean),
  };
}
