# PERF-1.1 local evidence

Status: partial (`[~]`)
Dataset: `PERF20260817`, 1,000 products, 5,000 SKUs and 5,000 local barcodes
Profiles: 3 samples/profile, 1 warm-up, concurrency 1/5/20
Reports: `perf-0.2-fixture.json` (before), `perf-1.1-after.json` (after)

## Code evidence

- `readTrustedRequestContext` queries session expiry/revocation, actor and active
  memberships in one Prisma `authSession.findFirst` operation.
- Catalog, dashboard and `/api/stores` use the trusted context loader.
- Selected store remains an httpOnly server cookie preference and is validated
  against returned active memberships by `resolveStoreContext`.
- Unit tests verify one repository call and null for invalid session results.

## Measurement

The after report completed with HTTP 200 responses except one timeout at catalog
list concurrency 1; that sample is counted as an error and excluded from latency
percentiles. Representative after p95 values were:

| Endpoint | c=1 | c=5 | c=20 |
| --- | ---: | ---: | ---: |
| Auth me | 672.7 ms | 569.4 ms | 687.7 ms |
| Catalog list | 1,922.9 ms | 1,622.0 ms | 4,200.4 ms |
| Catalog detail | 719.8 ms | 1,470.7 ms | 3,844.6 ms |

The target is not met and the run is not a clean causal before/after comparison:
the remote pooler had high variance and the single-query change did not produce a
proven reduction. Keep `[~]`, investigate pool/query plan and repeat in a same-region
controlled environment before moving the performance gate.
