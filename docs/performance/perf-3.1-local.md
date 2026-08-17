# PERF-3.1 TanStack query keys

Status: complete (`[x]`)

Implemented:

- Unified catalog key factory for list/detail/overview/units.
- Add/update/archive SKU mutations invalidate only the affected detail, product-list
  namespace and overview aggregate.
- SKU invalidations are dispatched with `Promise.all`, so active queries are not
  awaited as a sequential refetch chain.
- Store selection clears the complete tenant-sensitive catalog namespace before
  reload, preventing stale Store A data from being rendered for Store B.
- Added key/reset tests; no auth decision depends on these keys.

## Lifecycle implementation

- `PUT /api/catalog/products/:id/skus/:skuId` updates price/conversion only after
  server-side store/permission/state checks.
- Update requires an audit reason and `expectedUpdatedAt`; a concurrent write
  returns conflict instead of silently overwriting another operator.
- Exact conversion input is carried as a decimal string with at most six decimal
  places. Price remains a safe integer minor-unit value.
- Price/conversion before/after snapshots and actor/store/reason are written to
  `AuditLog` in the same transaction.
- Product detail UI supports update and archive with explicit reasons. Archive
  remains soft-delete and preserves the last-active-SKU guard.

## Browser evidence

Production build + disposable PostgreSQL 16 was exercised through the UI on
Chromium and Firefox. Each engine completed add -> update -> archive:

| Flow | Mutation | Active refetch | List/overview API refetch | Result |
| --- | --- | --- | ---: | --- |
| Add SKU | 1 POST | 1 detail GET | 0 | 201 |
| Update price/conversion | 1 PUT | 1 detail GET | 0 | 200, conversion `2`, price `1500` |
| Archive SKU | 1 PATCH | 1 detail GET | 0 | 200 |

All 13 browser criteria passed in both engines. Dashboard mutation convergence
still used one overview GET after navigation, cache remained visible during the
delayed refetch, and cleanup left zero active `BROWSER-PERF-*` SKUs.

Evidence:

- `perf-3.1-browser-chromium.json`
- `perf-3.1-browser-firefox.json`

Correctness verification: 65 tests across 17 files, typecheck and lint passed
before browser execution; the production build and all five migrations were used
for the browser profile. Full final verification is recorded in HANDOFF.
