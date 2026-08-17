# PERF-2.2 catalog search classification

Status: complete (`[x]`)

Implemented:

- Exact-looking SKU terms use normalized equality instead of `contains`.
- Numeric barcode terms (six or more digits) use normalized equality.
- Name/brand/registration terms retain free-text `contains` semantics.
- All branches remain tenant-scoped and active-record scoped.
- Tests cover code normalization, equality predicates and barcode classification.

Current-source evidence:
[perf-2.2-explain-local.json](./perf-2.2-explain-local.json) was captured on a
disposable PostgreSQL 16 database after applying all five migrations, seeding the
demo store and loading exactly 1,000 products, 5,000 SKUs and 5,000 barcodes.

- Exact SKU: `store_skus_store_id_code_key`, `Index Scan`, 0.046ms execution.
- Exact barcode: `store_barcodes_store_id_barcode_key`, `Index Scan`, 0.042ms.
- Free-text display name: tenant bitmap index plus heap filter, 0.893ms, below
  the explicit 10ms current-fixture budget.
- All four automated EXPLAIN criteria passed; fixture cleanup was verified at
  0 products, 0 SKUs and 0 barcodes before the container was removed.

The earlier remote-pooler report remains at
[perf-2.2-explain.json](./perf-2.2-explain.json) as historical evidence; it also
showed sub-millisecond exact paths and a 2.36ms free-text scan at the same scale.

Decision: do not add `pg_trgm` or another index migration now. Reopen at a
versioned 100,000-product fixture or when warm free-text API p95 exceeds its
budget, then record index storage/write cost and use an additive migration with
rollback notes. This is a future reopen condition, not an unmet current gate.

Verification for this increment: 59 tests across 17 files, typecheck, lint,
Prisma validation, production build, JSON criteria/secret audit and diff check
passed. All five migrations applied from empty before the fixture was loaded.
