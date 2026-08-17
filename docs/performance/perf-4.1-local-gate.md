# PERF-4.1 deployment/pool/load gate

Status: exception (`[!]`)

## Environment

- Runtime: local Next.js production server (`127.0.0.1`), Node v22.23.1.
- Database: Supabase pooler host in `ap-northeast-2`; exact provider region is not
  independently asserted by the application.
- Pool: runtime uses `DATABASE_URL`; migration URL remains separate in config.
- Configuration check: `npm run perf:config` passes; runtime is transaction-pooler
  on port 6543 and migration URL is session-pooler on port 5432. The check prints
  only host/port/mode and never credentials.
- Dataset: synthetic namespace `PERF20260817`, 1,000 products, 5,000 SKUs and
  5,000 barcodes; loaded only with explicit opt-in and cleaned after measurement.
- Profiles: warm-up 1, samples 3 per endpoint/profile, concurrency 1/5/20.

## Evidence

- [perf-0.2-fixture.json](./perf-0.2-fixture.json): baseline instrumentation run.
- [perf-1.1-after.json](./perf-1.1-after.json): trusted-context/session-touch run.
- [perf-2.2-explain.json](./perf-2.2-explain.json): exact/free-text query plans.
- [perf-4.1-overview.json](./perf-4.1-overview.json): read-only catalog overview
  API profile using the same production build and concurrency matrix.
- [perf-4.1-same-region-local.md](./perf-4.1-same-region-local.md): controlled
  local runtime/database pair with the full 1/5/20 profile.
- [perf-4.1-db-telemetry.json](./perf-4.1-db-telemetry.json): read-only
  PostgreSQL connection/wait/cache snapshot; statement stats are recorded when
  `pg_stat_statements` is enabled.

The fixture run returned 200 for almost all requests but catalog p95 at
concurrency 20 remained roughly 3–4 seconds, above the catalog <=400ms target.
The overview API was also measured (2 samples/profile, one warm-up): p95 was
778.8 ms at concurrency 1, 785.4 ms at concurrency 5 and 2,445.5 ms at
concurrency 20. This is below the 800 ms dashboard target only for sequential
and c=5 in this remote-pooler run; it is not a same-region SLO pass. No SLO pass
is claimed; errors/timeouts are not counted as successful latency.

The disposable same-region local pair did pass the fixture SLOs: catalog list
p95 was 31.0/49.8/121.9 ms and overview p95 was 24.9/36.1/106.2 ms at
concurrency 1/5/20. This isolates the remote-pooler/network contribution, but
is not a production deployment pass.

## Exception

- Owner: project maintainer.
- Remediation: run the same production build in the database region or run a
  staging database/runtime pair in one region, collect pool active/waiting
  connections and database CPU/slow-query evidence, then repeat profiles 1/5/20.
- Decision deadline: before starting E2 inventory migration.
- Do not increase pool size or add Redis to mask the unresolved query/network
  bottleneck.

No schema or migration change is required for this exception report.

The reusable collector is `npm run perf:db-telemetry`. It refuses non-local
targets unless explicitly approved, omits query text/parameters, and reports the
provider limitation that PostgreSQL statistics do not expose host CPU usage.

## Topology update — 2026-08-17

Production deployment is now configured for Vercel `icn1` and Supabase
`ap-northeast-2`, so the topology is intended to be same-region. This does not
retroactively convert the local-runtime/remote-pooler measurements above into a
deployed pass. PERF-4.1 remains an exception until the current production/staging
revision is measured with the controlled 1/5/20 profile and provider telemetry.
