# Trusted-context SQL call evidence

Date: 2026-08-17  
Tasks: PERF-1.1, PERF-1.2, PERF-2.1, PERF-2.3  
Environment: local disposable, same-host runtime/database  
Build: Next.js production, Node.js 22, PostgreSQL 16  
Dataset: deterministic demo seed (1 store product, 1 active SKU)  
Profile: 3 sequential measured requests per endpoint after one warm-up

## Result

`pg_stat_statements` observed a stable SQL-call reduction after the trusted
request-context adapter changed from a nested Prisma relation read to one
parameterized PostgreSQL statement.

| Endpoint | Before SQL calls | After SQL calls | Change | Before p95 | After p95 | HTTP errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `GET /api/auth/me` | 2 | 1 | -50.0% | 23.4 ms | 20.9 ms | 0/6 |
| Catalog list, no total | 9 | 6 | -33.3% | 39.8 ms | 28.7 ms | 0/6 |
| Catalog list, `includeTotal=true` | 10 | 7 | -30.0% | 35.3 ms | 23.1 ms | 0/6 |
| Catalog detail | 11 | 8 | -27.3% | 28.8 ms | 41.5 ms | 0/6 |
| Catalog overview | 6 | 3 | -50.0% | 26.7 ms | 36.4 ms | 0/6 |

Latency values below are `p50 / p90 / p95 / max`; failed responses would be
excluded from latency percentiles and included in the error rate.

| Endpoint | Before latency | After latency | Before/after n | Error rate |
| --- | ---: | ---: | ---: | ---: |
| `GET /api/auth/me` | 20.7 / 23.4 / 23.4 / 23.4 ms | 17.0 / 20.9 / 20.9 / 20.9 ms | 3 / 3 | 0 / 0 |
| Catalog list, no total | 36.7 / 39.8 / 39.8 / 39.8 ms | 23.9 / 28.7 / 28.7 / 28.7 ms | 3 / 3 | 0 / 0 |
| Catalog list, `includeTotal=true` | 28.5 / 35.3 / 35.3 / 35.3 ms | 21.4 / 23.1 / 23.1 / 23.1 ms | 3 / 3 | 0 / 0 |
| Catalog detail | 21.1 / 28.8 / 28.8 / 28.8 ms | 28.4 / 41.5 / 41.5 / 41.5 ms | 3 / 3 | 0 / 0 |
| Catalog overview | 24.4 / 26.7 / 26.7 / 26.7 ms | 27.2 / 36.4 / 36.4 / 36.4 ms | 3 / 3 | 0 / 0 |

Every endpoint produced the same SQL count in all three samples. The after
profile passed all five configured call-count contracts. Payload sizes were
unchanged for the same endpoint, and every measured response was HTTP 200.

The catalog list now has six total statements: one trusted-context statement and
five relation reads emitted by the catalog repository. Explicit total reporting
adds exactly one `COUNT` statement. Catalog overview has one trusted-context
statement plus the intended two business reads (conditional aggregate and recent
products).

## Interpretation

- PERF-1.1 now satisfies the actual database-statement requirement, rather than
  only proving one JavaScript repository invocation. The previous nested Prisma
  select emitted four trusted-context `SELECT` statements through the driver
  adapter; the parameterized read model emits one.
- PERF-1.2 has no remaining runtime caller of the synchronous legacy
  `getCurrentUser`/membership chain. Expiry and revocation remain synchronous;
  the throttled `lastUsedAt` update remains in Next's `after()` callback.
- PERF-2.1 now has authoritative current counts. The optional-total branch is a
  same-build counterfactual showing that interactive list requests avoid one SQL
  call. It is not a captured historical pre-PERF-2.1 implementation.
- PERF-2.3 now proves the current dashboard budget of two business reads and
  three total statements including authorization. It does not reconstruct the
  former four-count implementation.

The local latency samples are diagnostic only: `n=3` per profile, a tiny dataset and
same-host networking are insufficient for a production latency conclusion.
They must not replace PERF-4.1 deployed same-region/provider telemetry.

## Reproduction and safeguards

Run a production server against an otherwise idle disposable PostgreSQL database
with `shared_preload_libraries=pg_stat_statements`, install the extension, and
then execute:

```bash
PERF_ENVIRONMENT=local-disposable \
PERF_BASE_URL=http://127.0.0.1:4200 \
PERF_QUERY_COUNT_DATABASE_URL='<local-disposable-postgres-url>' \
npm run perf:query-count
```

The collector rejects non-local app/database hosts and any environment label
other than `local-disposable`. It resets database-wide statistics between
samples, so the database must be idle and disposable. Reports contain only
command categories, aggregate calls/rows, timings and payload sizes; SQL text,
parameters, cookies and credentials are never persisted.

Machine-readable evidence:

- `perf-query-count-before-local.json`
- `perf-query-count-after-local.json`

Correctness verification for this increment: 56 tests across 16 files,
TypeScript typecheck, ESLint, Prisma schema validation, production build, script
syntax and diff check all passed. All five committed migrations were also
applied from empty before the integration capture.

## Remaining evidence

PERF-2.1 and PERF-2.3 stay partial because their historical pre-change catalog
and dashboard implementations were not measured under this exact profile. The
current-state contracts are now enforceable, but they are not a substitute for
missing historical evidence. PERF-4.1 still requires the deployed topology and
provider CPU/connection/wait telemetry.
