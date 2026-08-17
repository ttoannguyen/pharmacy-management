# PERF-0.2 local benchmark harness

Status: partial (`[~]`)
Runner: `scripts/performance/api-benchmark.mjs`
Command: `PERF_ENVIRONMENT=local npm run perf:benchmark`

Latest report: `perf-0.2-local.json` (local production build, Node v22.23.1,
runtime/database region `unknown-local`, working-tree build, 3 measured samples
per concurrency profile plus 1 warm-up).

The runner logs in once with the documented synthetic demo account, stores the
session cookie only in process memory, performs a separate warm-up phase, then
measures `/api/auth/me`, catalog list and catalog detail at concurrency 1, 5 and
20. It reports p50/p90/p95/max, sample count, status counts, error rate and a few
`Server-Timing` samples. It refuses non-local targets unless explicitly approved
with `PERF_ALLOW_REMOTE=1`.

The first local production server/database attempt was not clean: port 3000 was already
occupied and the attempted login did not return within the previous runner's
timeout. A successful run was then completed on port 3200 and is recorded in the
JSON report. The runner now has a per-request timeout to prevent indefinite
hangs. The remaining acceptance work is a deterministic
synthetic fixture (1,000 products/5,000 SKUs/barcodes), explicit cleanup and an
actual before/after report from the same environment/profile. The synthetic
fixture run is now recorded separately in `perf-0.2-fixture.json`.

Fixture command (requires explicit local database guard):

```bash
PERF_ENVIRONMENT=local PERF_ALLOW_SYNTHETIC_DB=1 npm run perf:fixture -- load
PERF_ENVIRONMENT=local PERF_ALLOW_SYNTHETIC_DB=1 npm run perf:fixture -- cleanup
```

The current `.env` points to a non-local pooler, so the guard correctly refused
to mutate it. `PERF_ALLOW_REMOTE=1` is intentionally not used automatically.
