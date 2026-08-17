# PERF-3.2 provider boundary

Status: implemented for local Chromium gate (`[x]`)

Implemented:

- Removed `AppProviders` from the root layout.
- Mounted QueryClientProvider only under `/dashboard` authenticated layout.
- Home and login no longer load the TanStack Query client boundary.
- Catalog/dashboard Server Components still pass initial data into client query
  hooks without an internal HTTP waterfall.

Verification: 45 tests, typecheck, lint, production build and diff check pass.

Bundle evidence: [perf-3.2-bundle.json](./perf-3.2-bundle.json) records the
current production build. The root manifest's six common assets total 169,817
gzip bytes; the query-client chunks are listed separately and are not imported
by `src/app/layout.tsx`. The source boundary is also asserted in the report:
`rootMountsQueryProvider=false`, `dashboardMountsQueryProvider=true`.

Browser evidence: [perf-3.2-browser.json](./perf-3.2-browser.json) was generated
with the repository's `npm run perf:browser` runner against a disposable local
database and production server. The latest run measured dashboard LCP 236ms,
CLS 0, INP 16ms; catalog LCP 104ms and CLS 0. The SKU mutation trace tested
both POST (add) and PATCH (archive), with one active detail GET and no sequential
list/overview refetch chain on that detail screen.

This closes the MVP Chromium + Firefox gate. WebKit/Safari is explicitly deferred
from MVP because the current host lacks native dependencies; it remains a
pre-release follow-up and is not inferred from the Chromium/Firefox runs.

The same runner also passed on Firefox: dashboard LCP 378ms/CLS 0/INP 24ms and
catalog LCP 183ms/CLS 0. WebKit was attempted but the host lacks its native GTK,
GStreamer and accessibility libraries; it is recorded as an environment blocker,
not a pass.

To reproduce on a machine with Playwright browser dependencies:

```bash
npx playwright install chromium
PERF_ENVIRONMENT=local PERF_BASE_URL=http://127.0.0.1:3000 \
  npm run perf:browser
```

For Firefox use `PERF_BROWSER=firefox`; WebKit requires the dependencies reported
by `npx playwright install-deps webkit` or a Playwright CI container.
