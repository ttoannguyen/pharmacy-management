# PERF-2.2 catalog search classification

Status: partial (`[~]`)

Implemented:

- Exact-looking SKU terms use normalized equality instead of `contains`.
- Numeric barcode terms (six or more digits) use normalized equality.
- Name/brand/registration terms retain free-text `contains` semantics.
- All branches remain tenant-scoped and active-record scoped.
- Tests cover code normalization, equality predicates and barcode classification.

Remaining: capture `EXPLAIN (ANALYZE, BUFFERS)` on the synthetic fixture and decide
whether prefix/full-text/`pg_trgm` indexing is justified by the provider. No index
 migration has been added based on speculation.

Latest evidence: [perf-2.2-explain.json](./perf-2.2-explain.json). Exact SKU and
barcode queries use the existing composite unique indexes (`Index Scan`, under
1ms execution in this run). Free-text display-name search used a `Seq Scan` at
1,000 products and about 2.36ms execution, so no `pg_trgm` migration is justified
yet. Revisit at a versioned larger fixture (for example 100,000 products) and
record storage/write cost before adding an additive index.
