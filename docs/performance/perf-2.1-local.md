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

Current database evidence: interactive list is stable at 6 total SQL calls and
the same-build `includeTotal=true` branch is stable at 7, proving the hot path
avoids one count statement. See `perf-query-count-local.md`.

Remaining: the exact historical pre-PERF-2.1 implementation was not captured on
this profile. Keep the task partial rather than treating the optional-total
counterfactual as historical evidence or claiming a production SLO.
