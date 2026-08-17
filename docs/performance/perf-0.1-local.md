# PERF-0.1 local evidence

Date: 2026-08-17
Status: partial (`[~]`)
Environment: local Next.js production build; database/provider region not recorded
in this change
Dataset: existing local/demo dataset; no synthetic load fixture yet

## Implementation evidence

- Shared helper: `src/lib/request-observability.ts`.
- Instrumented routes: `/api/auth/me`, catalog list and catalog detail (GET/PATCH).
- Headers: `x-request-id` and `server-timing`.
- Phases: `auth`, `membership`, `repository`, `serialize` on trusted catalog
  routes. `auth` covers the single trusted context read; `membership` covers
  server-side selected-store authorization.
- Logs: structured JSON contains only event, request ID and timing summary.

## Verification

- `npm test`: 37 tests passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.

## Before/after limitation

The existing benchmark reports were captured before the phase split was deployed.
The plan's pre-existing baseline is observational (`/api/auth/me` p50 241 ms,
catalog search p50 748 ms, n=5/10 respectively), not a version-controlled run
with the new headers and the same benchmark profile. PERF-0.2 must provide the
repeatable warm-up, concurrency 1/5/20 and status/error report before PERF-0.1
can be marked complete. No latency improvement is claimed here.

## Phase-split rerun

`perf-0.1-after-phase.json` is a fresh local production-server run after the
phase split (one measured sample per concurrency and one warm-up). Catalog list
responses now include `auth`, `membership`, `repository` and `serialize`; the
membership authorization phase measured `0.0ms` at report precision because it
is in-memory. This confirms the phase contract, but the run still uses the
remote pooler and is not a same-region SLO result.

Next: rerun `npm run perf:benchmark` with the same fixture/profile after this
phase split and compare the `auth`/`membership` breakdown without claiming a
latency improvement from remote-pooler measurements.
