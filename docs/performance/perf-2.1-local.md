# PERF-2.1 catalog hot path

Status: partial (`[~]`)

Implemented:

- Store catalog search fetches `pageSize + 1` rows and derives `hasNextPage`.
- `total` is `null` by default; `includeTotal=true` is explicit and preserves the
  old count behavior only when a UX requires it.
- UI pagination no longer requires a count and does not show a blank layout while
  changing page/filter.
- Exact barcode lookup remains normalized and tenant-scoped.
- Added tests for no-count hot path, page-size trimming and `hasNextPage`.

Verification: 42 tests, typecheck, lint, production build, Prisma validate and
diff check pass.

Remaining: run before/after fixture measurements with payload size and query-count
evidence after the trusted-context changes settle; do not claim the <=400ms SLO yet.
