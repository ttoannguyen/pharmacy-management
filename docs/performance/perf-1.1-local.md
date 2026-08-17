# PERF-1.1 local evidence

Status: complete (`[x]`)

Historical remote dataset: `PERF20260817`, 1,000 products, 5,000 SKUs and 5,000
local barcodes. Current statement-count fixture: deterministic demo seed with one
product/SKU, 3 sequential samples after warm-up.

## Code evidence

- `readTrustedRequestContext` queries session expiry/revocation, actor and active
  memberships in one parameterized PostgreSQL statement. The previous nested
  Prisma operation was removed after database evidence showed it emitted four
  statements through the driver adapter.
- Catalog, dashboard and `/api/stores` use the trusted context loader.
- Selected store remains an httpOnly server cookie preference and is validated
  against returned active memberships by `resolveStoreContext`.
- Unit tests verify one parameterized repository call, hashed token binding,
  expiry/revocation and active membership/store predicates, invalid sessions and
  an actor without memberships.

## Measurement

The after report completed with HTTP 200 responses except one timeout at catalog
list concurrency 1; that sample is counted as an error and excluded from latency
percentiles. Representative after p95 values were:

| Endpoint | c=1 | c=5 | c=20 |
| --- | ---: | ---: | ---: |
| Auth me | 672.7 ms | 569.4 ms | 687.7 ms |
| Catalog list | 1,922.9 ms | 1,622.0 ms | 4,200.4 ms |
| Catalog detail | 719.8 ms | 1,470.7 ms | 3,844.6 ms |

That historical remote-pooler run remains useful variance evidence but did not
prove causality. A later same-profile disposable PostgreSQL 16 capture measured
the actual SQL boundary before and after the correction:

| Endpoint | Before calls | After calls | After p95 |
| --- | ---: | ---: | ---: |
| Auth me | 2 | 1 | 20.9 ms |
| Catalog list | 9 | 6 | 28.7 ms |
| Catalog detail | 11 | 8 | 41.5 ms |
| Catalog overview | 6 | 3 | 36.4 ms |

All counts were stable across three samples and every response was HTTP 200. The
authenticated context is now one database statement and is below the local
same-region 200 ms exit gate. See `perf-query-count-local.md` and its two JSON
reports. This closes PERF-1.1 without treating local latency as a deployed
production SLO.
