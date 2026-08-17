# PERF-4.1 disposable same-region local evidence

Status: controlled local gate passed; production-region gate remains an exception

Environment: Next.js production server and PostgreSQL 16 ran on the same local
Docker host. The database container and synthetic rows were removed after the
run.

Dataset: `PERFLOCAL20260817`, 1,000 products, 5,000 SKUs and 5,000 barcodes.
Profiles: 5 measured samples per request/concurrency, 2 warm-ups, concurrency
1/5/20. All requests returned HTTP 200 and error rate was 0.

| Endpoint | c=1 p95 | c=5 p95 | c=20 p95 | Payload p50 |
| --- | ---: | ---: | ---: | ---: |
| Auth me | 11.3 ms | 25.4 ms | 77.7 ms | 280 B |
| Catalog list | 31.0 ms | 49.8 ms | 121.9 ms | 659 B |
| Catalog detail | 13.3 ms | 59.9 ms | 115.6 ms | 945 B |
| Catalog overview | 24.9 ms | 36.1 ms | 106.2 ms | 970 B |

The local same-region run satisfies the catalog (`<=400ms`), dashboard
(`<=800ms`) and authenticated-context (`<=200ms`) latency targets for this
fixture. It does not replace a production-like provider run: the configured
Supabase pooler remains remote from the runtime, so PERF-4.1 keeps its explicit
production exception until an equivalent staging pair is available.

Raw report: [perf-4.1-same-region-local.json](./perf-4.1-same-region-local.json).
