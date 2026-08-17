# PERF-3.4 cached dashboard and progressive warmup

- Task: `PERF-3.4`
- Status: complete for the local MVP browser gate
- Date: 2026-08-17
- Environment: production build on local Node 22; PostgreSQL 16 and Playwright
  browser containers were disposable and in the same local region
- Dataset: deterministic synthetic demo seed, one product and one active SKU
- Profile: five control reloads and five warm client returns per browser at
  1440×900; all samples remained inside the 30-second overview `staleTime`
- Source: working tree based on commit `63f5fb9`

Raw reports:

- [Chromium before](./perf-3.4-browser-before-chromium.json)
- [Chromium after](./perf-3.4-browser-after-chromium.json)
- [Firefox after](./perf-3.4-browser-after-firefox.json)

## Before and after

The first controlled trace proved that TanStack already suppressed overview API
refetches, but it exposed a remaining route cost: every warm Dashboard return
still waited for a dynamic RSC request, and `dashboard/page.tsx` read the trusted
workspace again. Chromium warm-return p50/p95 was `392.4/403.3ms` (`n=5`) even
though overview request count was zero.

The dashboard home now consumes the workspace already authorized by the persistent
dashboard layout. The Dashboard navigation link alone uses full dynamic-route
prefetch; Catalog is not full-prefetched, avoiding a duplicate server catalog read
beside the existing bounded data warmup.

| Browser/profile | p50 | p90 | p95/max | Overview requests | Dashboard RSC on click |
| --- | ---: | ---: | ---: | ---: | ---: |
| Chromium control full reload | 161.7ms | 181.2ms | 181.2ms | 5/5 | n/a |
| Chromium warm client return | 46.1ms | 48.4ms | 48.4ms | 0/5 | 0/5 |
| Firefox control full reload | 168.6ms | 252.2ms | 252.2ms | 5/5 | n/a |
| Firefox warm client return | 85.0ms | 108.6ms | 108.6ms | 0/5 | 0/5 |

Control reloads each made exactly one overview API request. The overview repository
performs one conditional aggregate and one bounded recent-products read, so each
warm return avoided those two business queries. The full-prefetched dashboard page
contains no repository/workspace read; direct entry is still authenticated by the
dashboard layout, and the overview API still re-authorizes every fetch.

The runner records dashboard RSC prefetch separately from requests issued after
the return click, so shifted work cannot be mistaken for eliminated work. Both
prefetch and on-click arrays were zero in every final warm cycle; the previously
visited dashboard route remained in the Router Cache.

No overview polling occurred during the warm samples: maximum observed cache age
was `3254.1ms` in Chromium and `2513.8ms` in Firefox, both below `staleTime` and
far below the 60-second visible-tab polling interval. Cached metrics remained
visible on every return with no skeleton or blank state.

## Mutation convergence

The runner adds a synthetic SKU through the real UI, delays the next overview GET
by 1.5 seconds, and returns through the client navigation path. Both browsers
showed the cached SKU count `1` with no skeleton while the request was pending,
then converged to committed count `2` with exactly one overview request. The
reported `returnAndConvergeMs` includes the intentional 1.5-second delay.

The created SKU was archived through the tenant-scoped API after each trace
(`HTTP 200`). No API request failed; the database and application containers were
removed after the run.

## Page/browser budgets

- Chromium dashboard/catalog LCP: `284/436ms`; CLS `0`; observed dashboard INP
  `16ms`.
- Firefox dashboard/catalog LCP: `435/55ms`; CLS `0`; observed dashboard INP
  `16ms`.
- These local results pass the existing MVP browser budgets. They do not replace
  the production-region gate or the deferred WebKit/Safari public-release run.

## Correctness verification

- Direct `/dashboard` access continues through the authenticated layout.
- Workspace data passed to the client is the server-resolved membership result;
  it is not accepted from request input and is not authorization proof for APIs.
- Query keys remain tenant-namespaced, and mutation success still invalidates
  detail, list and overview only after server commit.
- `npm test`, `npm run typecheck`, `npm run lint` and the production build passed
  on the changed tree.

Remaining external work is unchanged: production runtime/database same-region
evidence and WebKit/Safari before public release.
