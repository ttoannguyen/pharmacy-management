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

Current database evidence: overview is stable at 3 total SQL calls: one trusted
context statement plus the intended aggregate and recent-products reads. The
same-profile trusted-context correction changed total calls from 6 to 3. See
`perf-query-count-local.md`.

Remaining: the historical pre-aggregate dashboard implementation was not
captured on this profile. Keep the task partial and do not infer a deployed SLO
from the small local fixture.
