# PERF-3.1 TanStack query keys

Status: partial (`[~]`)

Implemented:

- Unified catalog key factory for list/detail/overview/units.
- Add/update SKU mutations invalidate only the affected detail, product-list
  namespace and overview aggregate.
- SKU invalidations are dispatched with `Promise.all`, so active queries are not
  awaited as a sequential refetch chain.
- Store selection clears the complete tenant-sensitive catalog namespace before
  reload, preventing stale Store A data from being rendered for Store B.
- Added key/reset tests; no auth decision depends on these keys.

Verification: 45 tests, typecheck, lint, production build and diff check pass.

Remaining: browser trace or TanStack devtools evidence that add/update/archive
does not create a sequential refetch waterfall. The source-level dispatch test
proves concurrent invalidation calls but does not replace browser/network timing
evidence.
