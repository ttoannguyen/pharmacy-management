# Handoff

This file is append-only and records meaningful project changes for continuity.

## 2026-08-17 — Initial product and architecture specification

- Status: documentation baseline created; application code and database are not
  scaffolded yet.
- Decisions: Next.js modular monolith, PostgreSQL/Prisma, shared global medicine
  catalog plus store-local catalog, ledger-based inventory, FEFO allocation,
  batch-derived COGS, and reviewed catalog corrections.
- Files: `README.md`, `PROJECT_CONTEXT.md`, `AGENTS.md`, `docs/**`.
- Verification: documentation links and terminology checked locally.
- Next steps: scaffold the application, create the initial Prisma schema, and
  implement the first vertical slice from product catalog to goods receipt.
- Preserve: store data must remain tenant-scoped; inventory must remain
  movement-based; store overrides must not mutate global catalog data.

## 2026-08-17 — Milestone 0 application foundation

- Status: Next.js 16 application and Prisma 7/PostgreSQL foundation scaffolded.
- Decisions: Node.js 22+, TypeScript 6.0.3 for current Next ESLint compatibility,
  Prisma driver adapter for PostgreSQL, integer minor units for prices, and
  composite tenant constraints for StoreProduct -> StoreSku -> StoreBarcode.
- Files: application/tooling configs, `src/app/**`, `src/lib/**`, catalog domain,
  `prisma/schema.prisma`, and the initial migration.
- Verification: Prisma validate/generate, unit tests, TypeScript, Next production
  build, and ESLint completed; final clean verification should be rerun after this
  handoff/documentation update.
- Known gaps: no database instance was available to apply the migration; auth,
  catalog use cases, procurement, inventory ledger, and sales remain unimplemented.
- Next step: connect a local/Supabase PostgreSQL database, apply the initial
  migration, seed units/demo tenant, then implement tenant-scoped catalog lookup.
- Preserve: do not remove raw SQL check constraints or composite tenant foreign
  keys from the initial migration when regenerating Prisma artifacts.

## 2026-08-17 — Supabase migration and deterministic seed

- Status: initial migration applied successfully to the configured Supabase
  database; deterministic demo seed added and executed.
- Decisions: Prisma CLI uses `DIRECT_URL` (session/direct connection), while the
  application and seed use `DATABASE_URL` (runtime transaction pooler). Internal
  entity keys remain PostgreSQL UUID v4; human/business identifiers remain
  separate fields. UUID v7 is deferred for an ADR before append-heavy tables.
- Files: `prisma.config.ts`, `.env.example`, `prisma/seed.ts`, `package.json`,
  lockfile, README, and architecture documentation.
- Verification: migration deployed and up to date; seed rerun reported 8 units,
  1 demo store, and 1 demo store product. The seed uses an explicit 30-second
  interactive transaction timeout for Supabase latency; lint and TypeScript passed.
- Next step: implement tenant-scoped barcode lookup and test local -> verified
  global -> not-found behavior.
- Preserve: all seeded medicine/product data is marked `SYNTHETIC_DEMO` or uses a
  `DEMO` identifier and must never be represented as verified medical data.

## 2026-08-17 — Executable implementation plan and copyable prompts

- Status: detailed implementation plan created from the current repository state,
  with work packages, dependencies, acceptance criteria, and a shared Definition
  of Done through production hardening.
- Decisions: identity/trusted tenant context must precede catalog API work; catalog
  import can follow the catalog slice without blocking receipt -> sale delivery.
- Files: `docs/product/implementation-plan.md`,
  `docs/prompts/continue-mvp.md`, and README links.
- Verification: local documentation targets and terminology reviewed; no runtime
  behavior changed.
- Next step: execute P1.1 Authentication adapter, then P1.2 Active store context.
- Preserve: agents must inspect actual code before trusting plan checkboxes and may
  only mark tasks complete after acceptance tests and full verification pass.

## 2026-08-17 — P1.1 authentication adapter

- Status: Supabase SSR authentication implementation is complete at code level;
  live sign-in is pending two project variables because the current `.env` only
  contains database URLs.
- Decisions: use `@supabase/ssr` cookie sessions, Next.js 16 `proxy.ts` with
  `auth.getClaims()` for refresh, server boundary `auth.getUser()` for a fresh
  identity, and `User.externalAuthId` upsert for local synchronization. No token
  is stored in localStorage/sessionStorage.
- Files: `src/lib/supabase/**`, `proxy.ts`, identity application/infrastructure
  module, auth callback/login/me/dashboard routes, env schema, package lock and
  `.env.example`.
- Verification: lint, typecheck, build and 8 unit tests passed. Live auth was not
  exercised because `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are not present in `.env`.
- Next step: add those two non-secret/public Supabase project values, sign in with
  a real Auth user, verify `/api/auth/me` and dashboard, then implement P1.2 active
  store context.
- Preserve: Supabase publishable key may be client-visible; never add a Supabase
  secret/service-role key to browser code or public environment variables.

## 2026-08-17 — P1.1 architecture switched to application-owned auth

- Status: Supabase Auth dependency was removed from the runtime. P1.1 now uses
  Prisma/PostgreSQL for local credentials and sessions; the existing Supabase
  project remains only the hosted PostgreSQL provider.
- Decisions: Argon2id password hashing, opaque 256-bit session token, SHA-256 token
  hash in `AuthSession`, `__Host-` production cookie, server-side revoke/expiry,
  and persistent HMAC-keyed login rate limiting with `AUTH_PEPPER`.
- Files: `prisma/schema.prisma`, new local-auth application/infrastructure files,
  login/logout/me/dashboard routes, package dependencies, env example and docs.
- Verification: application-owned auth migration and tenant constraint migrations
  are deployed; deterministic seed, lint, typecheck, unit tests and production
  build pass. A live login requires a random server-only `AUTH_PEPPER` in `.env`.
- Next step: set `AUTH_PEPPER`, run the dev server, verify demo login
  (`owner@demo.invalid` / seed-only demo password), then implement P1.2.
- Preserve: never log or store plaintext passwords; never put `AUTH_PEPPER` in a
  `NEXT_PUBLIC_*` variable or client bundle.

## 2026-08-17 — P1.2 active store context

- Status: active tenant context is implemented and verified.
- Decisions: the authenticated local user is the actor; only active
  `Membership` rows connected to active stores are eligible. The selected store
  ID is stored in an httpOnly preference cookie, but every read and selection is
  re-authorized against Prisma membership data.
- Files: `src/modules/identity/application/store-context.ts`, Prisma store
  context adapter and active-store cookie, `/api/stores`, dashboard selector.
- Verification: 5 store-context unit cases, login/store selection smoke flow,
  typecheck, lint, tests and build pass.
- Next step: P1.3 authorization policy and API contract.

## 2026-08-17 — P1.3 authorization policy and API contract

- Status: role policy, shared API response helpers and tenant isolation checks are
  implemented.
- Decisions: permissions are explicit (`SELL_MEDICINE`, `MANAGE_CATALOG`,
  `MANAGE_INVENTORY`, `MANAGE_FINANCE`, `MANAGE_USERS`); resource store IDs are
  checked against the trusted active context before mutation.
- Files: `src/modules/identity/application/authorization.ts`,
  `src/lib/api-response.ts` and authorization tests.
- Verification: 3 policy/tenant tests; total suite 13 tests; typecheck, lint and
  build checks pass.
- Next step: P2.1 catalog repository ports and Prisma adapters.

## 2026-08-17 — P2.1 catalog repository ports and Prisma adapters

- Status: store/global catalog repository boundaries are implemented.
- Decisions: local queries require `storeId`; global barcode lookup requires
  verified barcode, package and registered product; pagination is capped at 100
  rows and scanner input is normalized before lookup.
- Files: `src/modules/catalog/application/catalog-repositories.ts` and
  `src/modules/catalog/infrastructure/prisma-catalog-repositories.ts`.
- Verification: repository boundary and normalization tests pass; total suite
  16 tests; typecheck, lint and build pass.
- Next step: P2.2 barcode lookup use case with `LOCAL_MATCH`, `GLOBAL_MATCHES`
  and `NOT_FOUND` results.

## 2026-08-17 — P2.2 barcode lookup and legacy uplift rules

- Status: barcode lookup use case is implemented with local-first resolution.
- Decisions: raw scanner input is retained for audit/debug, normalized input is
  used for repositories, and legacy/provider data is treated as a staged source
  that cannot auto-promote a global record to `VERIFIED`.
- Files: `src/modules/catalog/application/lookup-catalog.ts` and tests, plus
  legacy compatibility rules in `AGENTS.md` and catalog data strategy.
- Verification: local/global/not-found and raw-input tests pass; total suite 20
  tests.
- Next step: P2.3 create/link/override store product with explicit global version
  and audit event.

## 2026-08-17 — P2.3 store product create/link/override

- Status: local product creation, verified global linking and explicit overrides
  are implemented as transaction-safe application services.
- Decisions: catalog mutations require `MANAGE_CATALOG` and matching active
  `storeId`; SKU conversion must be positive and selling price is an integer
  minor unit; every mutation writes an AuditLog in the same transaction.
- Files: `src/modules/catalog/application/store-product-service.ts` and
  `src/modules/catalog/infrastructure/prisma-store-product-service.ts`.
- Verification: validation/policy tests pass; full suite has 22 tests, lint,
  typecheck and production build pass.
- Next step: expose P2.3 through a catalog API/UI, then continue inventory-ready
  SKU workflows.

## 2026-08-17 — P2.3 catalog API and quick-create UI

- Status: P2.3 is now exposed through authenticated catalog routes and a
  responsive dashboard quick-create form.
- Routes: `GET/POST /api/catalog/products`, `PATCH /api/catalog/products/:id`,
  and `GET /api/catalog/units`.
- Decisions: API injects `storeId` from the trusted active context instead of
  accepting it from the browser; barcode is optional and normalized before the
  local SKU is created.
- Verification: route tree builds successfully; 22 tests, lint, typecheck and
  production build pass.
- Next step: add TanStack Query around catalog search/mutations and scanner
  input, then continue inventory receipt workflows.

## 2026-08-17 — TanStack Query catalog client

- Status: TanStack Query is installed and wired through the app provider.
- Files: `src/modules/catalog/client/catalog-query.ts`, dashboard catalog page,
  quick-create form and scanner-friendly search input.
- Decisions: query cache is client convenience only; every API request still
  resolves and authorizes the active store server-side. USB/Bluetooth scanners
  are treated as keyboard input ending with Enter, with manual typing fallback.
- Verification: 22 tests, lint, typecheck and production build pass.
- Next step: camera scanner adapter and inventory receipt workflow.

## 2026-08-17 — MVP execution plan and Inter UI baseline

- Status: `docs/product/mvp-execution-plan.md` now records the executable critical
  path from catalog readiness through inventory, POS/FEFO/COGS, reporting and
  production hardening, with exit gates, API/cache rules and performance budgets.
- UI: dashboard typography uses the locally bundled Inter variable font with
  system fallbacks, so builds do not depend on a remote font request.
- Verification: documentation links/required files checked; typecheck, lint and
  production build pass after the font change.

## 2026-08-17 — E1.1 product detail and add SKU

- Status: E1.1 is implemented; E1.2 price/conversion policy and archive remain
  intentionally pending.
- Backend: tenant-scoped detail read model, `addStoreSku` application service,
  duplicate normalization/conflict handling, and atomic SKU + barcode + audit
  transaction.
- API/UI: `GET /api/catalog/products/:id`,
  `POST /api/catalog/products/:id/skus`, `/dashboard/catalog/:id`, detail SKU
  form and list-to-detail navigation with prefetch.
- Verification: 33 tests, lint, typecheck and production build pass; no schema
  change or migration was needed because existing composite tenant constraints
  and unique keys cover the use case.
- Next step: E1.2 price/conversion policy, lifecycle/archive and audit behavior.

## 2026-08-17 — Dashboard visual shell and catalog client UX

- Status: dashboard now follows the reference workspace layout with a fixed
  sidebar, grouped navigation, workspace topbar, store identity and responsive
  mobile collapse.
- Files: `src/app/dashboard/layout.tsx`, `dashboard-shell.tsx`, dashboard CSS,
  catalog page and TanStack Query client hooks.
- Verification: production build, typecheck, lint and 22 tests pass.

## 2026-08-17 — Product UX and catalog performance review

- Status: dashboard and catalog outside scan were reviewed and upgraded; missing
  inventory/sales/reporting modules are now represented honestly instead of by
  fake metrics or links that return 404.
- Decisions: dashboard metrics are tenant-scoped catalog aggregates until real
  ledger/sale snapshots exist. Catalog first paint is server-rendered, while
  TanStack Query handles the interactive cache, debounced/cancelled search,
  placeholder data and next-page prefetch. Server authorization remains the
  source of truth.
- Performance: request-local auth/store context is memoized, independent cookie
  and session reads run concurrently, session `lastUsedAt` writes are throttled
  to five minutes, and the catalog client waterfall was removed.
- Files: dashboard shell/home/loading UI, catalog list/create UI and query client,
  catalog overview/read-model infrastructure, search repository, session/store
  context, CSS, tests and product documentation.
- Verification: lint, TypeScript, 24 Vitest tests and Next production build pass.
- Gaps: goods receipts, inventory ledger, FEFO sales and financial reports are
  still unimplemented; p95 database/search latency needs a representative data
  set and deployed-environment load test.
- Preserve: do not show operational stock or financial metrics until they derive
  from immutable movements and transaction snapshots; never trust TanStack cache
  for tenant isolation or authorization.

## 2026-08-17 — MVP execution plan

- Status: an executable critical-path plan now covers catalog operational
  readiness through inventory ledger, receipt, POS/FEFO/COGS, reversal,
  reporting and production hardening; camera scan/OCR is explicitly excluded.
- Decisions: catalog product/SKU lifecycle is a prerequisite gate before
  inventory; receipt/checkout completion cannot use optimistic UI; dashboard
  finance waits for transaction snapshots; performance budgets must be measured
  with representative PostgreSQL data.
- Files: `docs/product/mvp-execution-plan.md`, implementation plan, contributor
  prompt, README and this handoff.
- Verification: documentation links, phase dependencies, business-rule IDs and
  repository baseline were reviewed; no runtime behavior or schema changed.
- Next step: E1.1 product detail, add-SKU use case/API/UI and tenant tests.
- Preserve: critical path is catalog readiness -> ledger/receipt -> FEFO sale ->
  reversal -> reporting; do not skip correctness gates to create placeholder UI.

## 2026-08-17 — E1.2 SKU archive increment

- Status: SKU archive is implemented as a tenant-scoped PATCH API; hard-delete is
  not exposed and the last active SKU of a product cannot be archived.
- Backend: archive mutation runs in a transaction, checks `MANAGE_CATALOG`,
  writes `archivedAt`/`isActive` and records before/after audit data.
- API: `PATCH /api/catalog/products/:id/skus/:skuId`, with safe 404/409/422/403
  mappings and no client-provided store identity.
- Verification: 35 Vitest tests, typecheck, lint and diff check pass. Price and
  conversion versioning plus product lifecycle UI remain next.

## 2026-08-17 — PERF-0.1 request observability

- Status: partial. Shared request observability now adds safe `x-request-id`,
  monotonic `Server-Timing` and structured request logs to auth and catalog API
  paths; task remains `[~]` until repeatable before/after benchmark evidence and
  separate membership timing exist.
- Files: `src/lib/request-observability.ts`, its tests, `/api/auth/me`, catalog
  list/detail routes and `docs/performance/perf-0.1-local.md`.
- Verification: 37 tests, typecheck, lint and production build pass.
- Next step: PERF-0.2 guarded synthetic benchmark with concurrency 1/5/20; do not
  claim a latency improvement from headers alone.

## 2026-08-17 — PERF-0.2 benchmark runner scaffold

- Status: partial. Added `scripts/performance/api-benchmark.mjs` and
  `perf:benchmark`; it guards the target, logs in once, excludes warm-up and
  reports p50/p90/p95/max/status/error rate for concurrency 1/5/20.
- Safety: default target is localhost, no fixture mutation is performed, cookies
  stay in memory and output excludes credentials/database URLs.
- Verification: `node --check`, 37 tests, typecheck, lint and diff check pass.
- Remaining: deterministic 1,000/5,000 synthetic fixture with namespace and
  cleanup, then run and commit a same-profile report.

## 2026-08-17 — PERF-0.2 local benchmark evidence

- Evidence: a production-build run on `127.0.0.1:3200` completed successfully
  with 3 samples/profile, 1 warm-up and concurrency 1/5/20; report is stored in
  `docs/performance/perf-0.2-local.json` without cookies or database URLs.
- Observed p95: auth-me 297/300/520 ms and catalog detail 784/1175/2879 ms for
  concurrency 1/5/20. Catalog concurrency-20 is above the target, so no SLO pass
  is claimed.
- Fixture: added guarded namespace/cleanup loader for 1,000 products and 5,000
  SKUs/barcodes. It correctly refused the configured non-local pooler without an
  explicit `PERF_ALLOW_REMOTE=1`; no remote mutation was performed.
- Next: run the fixture only in an approved synthetic environment, repeat the
  report with the same profile, then proceed to PERF-1 context optimization.

## 2026-08-17 — PERF-1.1 trusted request context

- Status: partial. Catalog, dashboard and stores now resolve session, active user
  and active memberships/store summaries from one tenant-safe Prisma query via
  `readTrustedRequestContext`; selected-store validation remains server-side.
- Tests: 39 tests pass, including one-query repository evidence and invalid-session
  handling. Legacy `getCurrentUser` remains for auth-me/login and session touch is
  intentionally deferred to PERF-1.2.
- Measurement: synthetic 1,000/5,000/5,000 fixture was loaded with explicit remote
  opt-in and cleaned immediately. After report is `docs/performance/perf-1.1-after.json`;
  catalog p95 remained above target with one timeout, so no performance win is claimed.
- Next: PERF-1.2 deferred session touch and controlled same-region rerun; keep this
  task `[~]` until the <=200ms/context gate or a documented exception is achieved.

## 2026-08-17 — PERF-1.2 deferred session touch

- Status: partial. Trusted context now schedules a throttled, compare-and-set
  `lastUsedAt` update through Next `after()`; expiry/revocation remain synchronous.
- Failure behavior: touch errors are swallowed after safe structured warning and do
  not fail catalog/dashboard responses. Added tests for interval, failure and
  concurrent-write guard.
- Verification: 41 tests, typecheck, lint and production build pass; no migration.
- Remaining: controlled same-region query/write benchmark before marking complete.

## 2026-08-17 — PERF-2.1 catalog count hot path

- Status: partial. Store catalog list now fetches `pageSize + 1`, derives
  `hasNextPage` and skips `COUNT(*)` by default; `includeTotal=true` is explicit.
- Contract/UI: DTO and TanStack types accept nullable total; pagination uses page
  range when total is not requested, preserving tenant and active-record filters.
- Verification: 42 tests, typecheck, lint, production build, Prisma validate and
  diff check pass. Controlled payload/query-count benchmark remains before the
  <=400ms gate can be assessed.

## 2026-08-17 — Performance and legacy change direction

- Status: measured latency has been converted into a P0 performance gate before
  inventory expansion. Current remote-database baseline misses the 400 ms warm
  catalog API target despite the small demo dataset.
- Decisions: complete E1.2, then instrument requests, collapse auth + membership
  into one trusted-context query, reduce catalog/dashboard query round-trips and
  validate indexes before E2. The 400 ms SLO applies to warm read APIs, not every
  page or transactional command.
- Files: `docs/product/performance-change-direction.md`, MVP/implementation plans,
  contributor prompt, README and this handoff.
- Verification: benchmark evidence, current query paths, client build artifacts,
  migrations and active/staged legacy references were reviewed; documentation
  diff check passed and no runtime behavior/schema changed.
- Next step: finish E1.2, then PERF-0 reproducible measurement and Server-Timing.
- Preserve: never cache authorization across requests, weaken session revocation,
  remove tenant scoping or make stock/money mutations optimistic to hit latency.

## 2026-08-17 — Canonical performance agent plan

- Status: the performance direction document is now the single executable plan
  for agents, with ordered task IDs, dependency/status table, per-task checklists,
  Definition of Done, evidence template and a copyable execution prompt.
- Files: `docs/product/performance-change-direction.md`, README, MVP execution
  plan and this handoff.
- Verification: documentation diff check and cross-references pass; no runtime
  code, schema or migration changed.
- Next step: PERF-0.1 request ID and Server-Timing; PERF-0.2 must wait until timing
  phases are stable.
- Preserve: performance checkboxes may only become complete with comparable
  before/after evidence and correctness verification.

## 2026-08-17 — PERF-2.3 dashboard aggregate

- Status: partial. Dashboard catalog overview now uses one parameterized
  conditional aggregate for four counts plus one recent-products query.
- Safety: all predicates include the active `storeId`; inactive products/SKUs and
  foreign barcodes cannot enter the aggregate. No ledger/financial data was added.
- Verification: 43 tests, typecheck, lint, production build, Prisma validate and
  diff check pass. Controlled p95/query-count comparison remains pending.

## 2026-08-17 — PERF-3.1 TanStack query keys

- Status: partial. Added a catalog query-key factory and replaced ad-hoc
  invalidation keys for list/detail/overview/units.
- Store safety: changing the active store removes the entire tenant-sensitive
  catalog namespace before reload; client cache is never used for authorization.
- Verification: 45 tests, typecheck, lint, production build and diff check pass.
- Remaining: browser trace/TanStack evidence for no sequential mutation refetch
  waterfall.

## 2026-08-17 — PERF-3.2 provider boundary

- Status: partial. `AppProviders` moved from the root layout into the authenticated
  dashboard layout, keeping home/login free of the QueryClient boundary.
- Hydration: catalog/dashboard client queries remain under the provider and retain
  server-first initial data; no internal HTTP waterfall was introduced.
- Verification: 45 tests, typecheck, lint, production build and diff check pass.
- Remaining: compressed route bundle and browser Web Vitals evidence.

## 2026-08-17 — PERF-3.2 bundle evidence

- Evidence: `npm run perf:bundle` writes `docs/performance/perf-3.2-bundle.json`;
  source boundary reports root provider `false`, dashboard provider `true`, and
  common root assets at 169,817 gzip bytes.
- Web Vitals: explicitly `not-measured` because no browser trace/Playwright runner
  exists in the repository; no false LCP/INP/CLS claim is made.

## 2026-08-17 — PERF-2.2 exact catalog search branch

- Status: partial. Exact-looking SKU and numeric barcode queries now use
  normalized equality; names/brands/registration numbers retain free-text search.
- Safety: all search branches remain tenant-scoped and active-only; no pg_trgm or
  other index migration was added without provider/EXPLAIN evidence.
- Verification: 47 tests, typecheck, lint, production build and diff check pass.
- Next: capture fixture-only `EXPLAIN (ANALYZE, BUFFERS)` and decide index strategy.

## 2026-08-17 — PERF-2.2 EXPLAIN evidence

- Evidence: `docs/performance/perf-2.2-explain.json` shows existing composite
  indexes for exact SKU/barcode (`Index Scan`, sub-millisecond execution) and a
  2.36ms free-text sequential scan at 1,000 products.
- Decision: no pg_trgm/index migration yet; revisit with a larger versioned fixture
  and document write/storage cost before adding one.
- Fixture safety: the first cleanup hit the remote pooler's 5s transaction timeout;
  cleanup was changed to idempotent sequential deletes and rerun successfully.

## 2026-08-17 — PERF-4.1 performance gate exception

- Status: `[!]` exception, not pass. Runtime is local while the configured Supabase
  pooler is in `ap-northeast-2`; catalog concurrency-20 p95 remains ~3–4s.
- Report: `docs/performance/perf-4.1-local-gate.md` records dataset, profile,
  evidence links, owner and remediation deadline before E2 inventory migration.
- Decision: do not increase pool size or add Redis speculatively; repeat in a
  same-region staging pair with provider CPU/connection/slow-query evidence.
- Configuration: `npm run perf:config` passes with transaction pooler `:6543` for
  runtime and session pooler `:5432` for migrations; output contains no secrets.

## 2026-08-17 — PERF-L.1 legacy cleanup contract

- Status: partial. Runtime Supabase Auth imports are absent; `externalAuthId` now
  has an explicit owner/retention/removal condition in the performance plan.
- Added guarded `db:migrate:empty-check` runner. It requires an explicit empty test
  database URL and refuses application/shared DB fallback or remote targets without
  opt-in. It was not run because no empty staging database was provisioned.
- Next: run the chain check in CI/staging before adding inventory migrations; keep
  compatibility fields and migration history append-only meanwhile.

## 2026-08-17 — PERF-4.1 dashboard overview measurement

- Added read-only `GET /api/catalog/overview` with the same request observability
  and trusted tenant context as catalog APIs.
- Added the endpoint to `scripts/performance/api-benchmark.mjs` so dashboard
  aggregate latency/payload/error metrics are reproducible.
- Evidence: `docs/performance/perf-4.1-overview.json`; c=1/c=5/c=20 p95 was
  778.8/785.4/2445.5 ms on the configured remote pooler. This remains exception
  evidence, not a same-region SLO pass.
- Verification: tests, typecheck, lint and production build pass.

## 2026-08-17 — PERF-3.1 concurrent catalog invalidation

- SKU mutation invalidations now dispatch detail/list/overview invalidations with
  `Promise.all` instead of awaiting three refetch triggers serially.
- Added a unit test proving all three invalidation calls are started before any
  promise resolves. Browser network trace remains required for the final gate.
- Verification: 48 tests, typecheck, lint and diff check pass.

## 2026-08-17 — PERF-L.1 empty migration chain

- Ran `db:migrate:empty-check` against a disposable local PostgreSQL 16 Alpine
  container on `127.0.0.1:55432`; the container was removed after verification.
- All four migrations applied successfully in order. Evidence:
  `docs/performance/perf-l.1-empty-migration.md`.
- This closes the empty-DB migration-chain gate. Browser matrix remains the only
  PERF-L.1 checklist item still pending.

## 2026-08-17 — PERF-L.1 CI and browser policy

- Added `.github/workflows/quality.yml` with a PostgreSQL 16 service. CI runs the
  guarded empty migration chain before tests, typecheck, lint and production build.
- Documented the minimum browser matrix: latest two stable Chrome/Edge/Firefox,
  latest two Safari macOS/iOS majors and latest two Chrome Android releases;
  IE11 is unsupported and no broad polyfill is planned.
- Browser Web Vitals execution remains a pre-release evidence task because this
  repository does not yet include a Playwright/browser-trace runner.

## 2026-08-17 — PERF-0.1 membership timing phase

- Trusted catalog and overview handlers now report separate `auth` and
  `membership` Server-Timing phases. `auth` measures the trusted context read;
  `membership` measures server-side store selection authorization.
- Existing benchmark reports predate this split, so PERF-0.1 remains partial until
  a controlled same-profile rerun records the new phase consistently.
- Verification: 48 tests, typecheck, lint and production build pass.
- Fresh phase-split evidence: `docs/performance/perf-0.1-after-phase.json`;
  catalog list/detail/overview responses contain the new `membership` phase and
  all measured requests returned HTTP 200 in this run.

## 2026-08-17 — PERF-4.1 disposable same-region gate

- Ran the full production server + PostgreSQL 16 fixture locally with 1/5/20
  concurrency, 5 samples/profile and 2 warm-ups; all 600 measured requests
  returned HTTP 200 with zero errors.
- p95 at c=1/5/20: catalog list `31.0/49.8/121.9ms`, detail
  `13.3/59.9/115.6ms`, overview `24.9/36.1/106.2ms`, auth `11.3/25.4/77.7ms`.
- Evidence: `docs/performance/perf-4.1-same-region-local.md` and its JSON report.
  This passes the disposable same-region gate but does not close the remote
  production-region exception.

## 2026-08-17 — PERF-3.2 Chromium browser evidence

- Added `@playwright/test` and `npm run perf:browser`; the runner captures
  navigation timing, LCP/CLS/INP and catalog mutation request paths without
  persisting cookies or credentials.
- Disposable local run measured dashboard LCP `236ms`, CLS `0`, INP `16ms`, and
  catalog LCP `104ms`, CLS `0`. The SKU mutation trace tested POST (add) and PATCH
  (archive), with one active detail GET and no sequential list/overview refetch
  chain on the detail page.
- Evidence: `docs/performance/perf-3.2-browser.json` and
  `docs/performance/perf-3.2-local.md`. Chromium local gate passes; cross-browser
  matrix execution remains a release follow-up.

## 2026-08-17 — PERF-4.1 database telemetry collector

- Added guarded read-only `npm run perf:db-telemetry` for PostgreSQL
  connections, wait events, cache counters and optional `pg_stat_statements`.
- Ran it against a disposable local PostgreSQL instance; evidence is
  `docs/performance/perf-4.1-db-telemetry.json`. Query text/parameters are never
  stored, and host CPU remains explicitly provider/dashboard-owned.

## 2026-08-17 — PERF-3.2 Firefox matrix evidence

- Ran the browser trace on Firefox against a disposable local DB: dashboard LCP
  `378ms`, CLS `0`, INP `24ms`; catalog LCP `183ms`, CLS `0`.
- WebKit launch was attempted and failed before navigation because the host lacks
  GTK/GStreamer/accessibility libraries. This is recorded as an environment
  blocker; no WebKit pass is claimed. Use Playwright CI/container dependencies to
  complete that matrix row.

## 2026-08-17 — WebKit scope decision

- Decision: do not block MVP on WebKit/Safari. Chromium and Firefox are the MVP
  browser evidence gate and both passed local disposable-environment traces.
- WebKit remains a required pre-public-release follow-up and must run in CI or a
  Playwright container with native dependencies. No WebKit pass is claimed for
  the current host.

## 2026-08-17 — Performance checklist audit alignment

- Reclassified remaining detailed acceptance checkboxes from `[ ]` to `[~]` where
  implementation/evidence exists but comparable query-count or legacy baseline is
  missing.
- Explicit limitations are now written beside PERF-1.2, PERF-2.1, PERF-2.3 and
  PERF-3.1; no task is presented as complete without its required evidence.

## 2026-08-17 — Browser evidence CI job

- Added a `browser-evidence` GitHub Actions job with a PostgreSQL service,
  migration/seed/build, Playwright Chromium + Firefox installation and both
  `perf:browser` runs.
- Reports are uploaded as the `performance-browser-evidence` artifact. WebKit is
  intentionally excluded from the MVP CI job per the documented scope decision.

## 2026-08-17 — CI reproducibility check

- `npm ci --ignore-scripts` completed successfully from the committed lockfile.
- Follow-up 48-test, typecheck, lint and diff checks remained green after the
  clean dependency installation.

## 2026-08-17 — Performance gate disposition

- Added section 7.1 to the performance direction documenting what is achieved in
  MVP scope, what is intentionally deferred (WebKit, inventory/POS load), and
  which gates require project-maintainer staging/provider access.
- This prevents local Docker evidence from being misread as a production SLO
  pass and gives the next owner explicit reopening conditions.

## 2026-08-17 — Cache consistency and progressive warmup strategy

- Status: cache correctness, database-change convergence and route/data warmup
  now have an explicit contract. Dashboard overview is confirmed as uncached by
  TanStack despite an existing API/query key.
- Decisions: PostgreSQL remains source of truth; cache is disposable; enable
  stale refresh on focus/reconnect, add tenant cache namespace, cache dashboard
  overview and use visible-tab polling before considering realtime events.
- Realtime direction: events only invalidate and trigger authoritative refetch;
  LISTEN/NOTIFY is a wake-up hint, while critical durability requires an outbox.
- Files: `docs/product/cache-consistency-strategy.md`, performance plan, README,
  contributor prompt and this handoff.
- Verification: current provider/query/dashboard paths and official TanStack,
  Next.js and PostgreSQL behavior were reviewed; documentation diff check passed;
  no runtime code/schema changed.
- Next step: PERF-3.3 cache consistency foundation, then PERF-3.4 cached dashboard
  and progressive warmup.
- Preserve: never persist or optimistically commit stock, money, authorization or
  audit mutations in the client cache.
