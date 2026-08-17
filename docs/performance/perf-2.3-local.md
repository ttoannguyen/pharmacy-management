# PERF-2.3 dashboard aggregate

Status: partial (`[~]`)

Implemented:

- Product/SKU/priced-SKU/identified-SKU counts now come from one parameterized
  conditional aggregate query.
- Recent products remain a second query, so the overview has at most two business
  reads after trusted context.
- Every aggregate predicate is constrained by `store_id`; inactive products/SKUs
  are excluded and barcode existence is tenant-scoped.
- Repository/application boundary is preserved.

Verification: 43 tests, typecheck, lint, production build, Prisma validate and
diff check pass.

Remaining: controlled before/after query-count and p95 evidence; no SLO pass is
claimed until the same-region environment is measured.
