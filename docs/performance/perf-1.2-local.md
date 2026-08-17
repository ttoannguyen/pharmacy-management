# PERF-1.2 local evidence

Status: complete (`[x]`)

## Implementation

- `shouldTouchSession` enforces the five-minute interval.
- `touchSessionBestEffort` uses an exact `sessionId + lastUsedAt` compare-and-set
  update, catches database failures and emits only a safe structured warning.
- Trusted context schedules the touch with Next `after()` so expiry/revocation
  remain synchronous but the write is outside the response path.

## Database evidence

The same disposable PostgreSQL 16 profile measured the trusted auth path before
and after the final caller migration. Auth changed from 2 to 1 SQL calls;
catalog list changed 9 to 6, detail 11 to 8 and overview 6 to 3. All counts were
stable across three samples and all responses were HTTP 200. See
`perf-query-count-local.md` and its before/after JSON reports.

No runtime caller remains for the synchronous legacy `getCurrentUser` plus
membership chain. Session expiry/revocation remain in the one synchronous
trusted-context statement; only throttled `lastUsedAt` maintenance is deferred.

No schema or migration changed. Deployed provider telemetry remains PERF-4.1 and
does not reopen this completed local implementation task.
