# Performance implementation plan

Ngày lập: 2026-08-17. Phạm vi đo và tối ưu không bao gồm camera scan/OCR.

Đây là **file kế hoạch duy nhất agent dùng để thực thi performance workstream**.
Các tài liệu MVP khác chỉ mô tả dependency và phải trỏ về file này; không tạo
checklist performance cạnh tranh ở nơi khác.

## 0. Hướng dẫn bắt buộc cho agent

Trước khi làm task trong plan này, đọc đầy đủ:

- `AGENTS.md`
- `PROJECT_CONTEXT.md`
- `HANDOFF.md`
- `docs/architecture.md`
- `docs/domain/business-rules.md`
- `docs/product/current-state-review.md`
- `docs/product/mvp-execution-plan.md`
- File plan này từ đầu đến cuối

Quy trình mỗi phiên:

1. Inspect code, Git status, schema, migrations và benchmark report hiện có; không
   giả định checkbox luôn khớp code.
2. Chọn task `[ ]` đầu tiên có dependency đã hoàn thành trong bảng Execution
   backlog bên dưới, trừ khi user chỉ định task khác.
3. Ghi baseline trước thay đổi bằng cùng environment/profile sẽ dùng để đo sau.
4. Chỉ sửa trong phạm vi task; không trộn feature, UI redesign hoặc refactor không
   phục vụ acceptance criteria.
5. Giữ tenant/session/business invariants; performance không phải lý do bỏ kiểm
   tra server-side.
6. Chạy correctness verification và benchmark sau thay đổi.
7. Chỉ đổi `[ ]` thành `[x]` khi toàn bộ acceptance criteria và evidence đạt.
8. Cập nhật report, plan checkbox và append `HANDOFF.md` trong cùng change.

Nếu target không đạt, không đánh dấu hoàn thành. Ghi kết quả, bottleneck tiếp theo
và giữ task ở `[~]`. Không thêm Redis, materialized view, denormalization hoặc
cache authorization nếu chưa có evidence và ADR/decision phù hợp.

### Trạng thái

- `[x]`: code, correctness tests, benchmark before/after và full verification đạt.
- `[~]`: có implementation/evidence nhưng chưa đạt exit gate.
- `[ ]`: chưa bắt đầu.
- `[!]`: bị block bởi external environment/decision; phải ghi blocker cụ thể.

### Definition of Done chung

- Before/after dùng cùng build, dataset, region và concurrency profile.
- Report có p50/p90/p95/max, status/error rate, sample size và environment label.
- Không tính response lỗi là request thành công nhanh.
- Có regression test cho auth, tenant hoặc query contract bị thay đổi.
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` đều đạt.
- Schema/index change có migration additive mới, Prisma validate/generate và
  migration-from-empty verification; không sửa migration đã apply.
- Không commit cookie, credential, database URL, raw production payload hoặc dữ
  liệu nhà thuốc thật.

## Execution backlog

Agent phải làm theo thứ tự dependency dưới đây. Mỗi task nên là một PR/change độc
lập nếu repository workflow có commit/PR.

| ID | Trạng thái | Task | Phụ thuộc | Exit chính |
| --- | --- | --- | --- | --- |
| PERF-0.1 | [~] | Request ID + Server-Timing | E1.2 hoặc làm song song | Helper, headers và route instrumentation đã có; membership phase đã tách; controlled before/after gate còn pending |
| PERF-0.2 | [x] | Benchmark harness + synthetic load fixture | PERF-0.1 | Runner, synthetic fixture, cleanup và fixture report đã có; SLO chưa đạt nhưng evidence đầy đủ |
| PERF-1.1 | [x] | Single-query trusted request context | PERF-0.2 | One parameterized SQL statement verified by same-profile pg_stat_statements before/after |
| PERF-1.2 | [x] | Session touch ngoài critical path + migrate callers | PERF-1.1 | Deferred touch, caller cleanup, security tests and controlled query-count/p95 evidence complete |
| PERF-2.1 | [~] | Catalog exact search + bỏ count hot path | PERF-1.2 | Current SQL contract proves optional total adds one call; historical pre-change profile is unavailable |
| PERF-2.2 | [x] | Free-text query plan + index migration nếu cần | PERF-2.1 | Current-source 1k/5k/5k EXPLAIN contract passes; no pg_trgm now, explicit future reopen trigger recorded |
| PERF-2.3 | [~] | Dashboard conditional aggregates | PERF-1.2 | Current budget is 2 business/3 total SQL calls; historical pre-aggregate profile is unavailable |
| PERF-3.1 | [x] | TanStack invalidation/query-key cleanup | PERF-2.1 | Add/update/archive SKU each produce one bounded detail refetch in Chromium/Firefox; no API waterfall |
| PERF-3.2 | [x] | Provider/client boundary + route bundle gate | PERF-3.1 | Provider, bundle report và Chromium/Firefox Web Vitals CI evidence đã có; WebKit vẫn là release follow-up |
| PERF-3.3 | [x] | Cache consistency foundation | PERF-3.1 implementation | Tenant namespace + focus/reconnect + mutation map có tests; 49 tests/typecheck/lint/build pass |
| PERF-3.4 | [x] | Cached dashboard + progressive warmup | PERF-3.3 | Chromium/Firefox control-vs-warm trace đạt; cached return có 0 overview/RSC request và mutation hội tụ bằng một refetch |
| PERF-4.1 | [!] | Same-region deploy/pool/load verification | PERF-2.2, PERF-2.3 | Topology đã cấu hình `icn1`/`ap-northeast-2`; deployed load/provider telemetry chưa có nên vẫn là exception |
| PERF-L.1 | [x] | Legacy cleanup contract | PERF-4.1 | Auth/migration policy, empty-chain CI và Chromium/Firefox MVP matrix đạt; WebKit là public-release follow-up riêng |

### Task đang được phép bắt đầu

Không còn task `[ ]` nào có thể bắt đầu chỉ bằng môi trường local. PERF-1.1/1.2
đã đóng bằng cùng profile PostgreSQL `pg_stat_statements`; PERF-3.4 đã đóng bằng
control-vs-warm trace trên Chromium/Firefox; PERF-2.2 đã đóng bằng current-source
EXPLAIN trên fixture disposable 1.000/5.000/5.000. Historical baseline còn thiếu
của PERF-0/2.1/2.3, deployed same-region gate và provider telemetry vẫn giữ trạng
thái partial/exception; không được tự nâng thành complete bằng số đo khác profile.
WebKit/Safari là follow-up trước public release theo quyết định MVP hiện tại.

---

## 1. Quyết định định hướng

Sau khi hoàn tất phần còn lại của E1.2, tạm dừng mở rộng feature để thực hiện một
**Performance Gate P0** trước E2 inventory. Lý do: request hiện tại đã có nhiều
database round-trip khi dữ liệu mới chỉ ở mức demo; nếu giữ cấu trúc này sang
receipt, inventory và POS thì latency và connection pressure sẽ tăng nhanh hơn
số tính năng.

Thay đổi trọng tâm:

```text
feature-first
  -> measured vertical slices
  -> một trusted request context / request
  -> read model ít round-trip
  -> index theo access pattern
  -> client cache chỉ hỗ trợ UX
  -> load gate trước khi mở phase tiếp theo
```

Không đánh đổi tenant isolation, session revocation, transaction correctness hay
audit để đạt latency target.

## 2. Baseline đã đo

Production build được chạy local, kết nối tới PostgreSQL/Supabase đang cấu hình.
Dataset hiện rất nhỏ nên kết quả chủ yếu phản ánh network/database round-trip,
không đại diện cho query cost ở quy mô production.

| Luồng | Baseline quan sát |
| --- | ---: |
| Auth `GET /api/auth/me` | p50 241 ms, max 284 ms, n=5 |
| Catalog search API | p50 748 ms, p90 919 ms, max 1.308 ms, n=10 |
| Dashboard warm | p50 808 ms, p95 1.613 ms, n=20 |
| Catalog page warm | p50 khoảng 1.214 giây, n=5 |
| Product detail API | p50 khoảng 1.438 giây, n=5, variance cao |
| Dashboard cold | TTFB 1.117 giây; complete 2.524 giây |
| Catalog cold | TTFB 1.443 giây; complete 2.730 giây |
| 5 catalog requests đồng thời | wall time 1.96 giây |

Client build hiện phát sinh khoảng 219 KB JavaScript gzip cho toàn bộ static JS;
catalog route entry thêm khoảng 24 KB gzip và CSS dùng chung khoảng 8 KB gzip.
Bundle cần tiếp tục theo dõi nhưng chưa phải bottleneck chính của baseline trên.

### Giới hạn của baseline

- Chưa có dataset đại diện, browser Web Vitals và network throttling.
- Mẫu detail/catalog page còn nhỏ; không dùng làm SLO production cuối cùng.
- Chưa đo connection-pool saturation, database CPU, query plan hoặc cold start
  của môi trường deploy.
- Không so sánh region runtime và database nên chưa quy kết toàn bộ latency cho
  provider hoặc network.

## 3. SLO và performance budget

Không dùng một con số 400 ms cho mọi loại thao tác. Mục tiêu `< 400 ms` áp dụng
cho warm read API thông thường; page render và transaction có budget riêng.

| Nhóm | Mục tiêu p95 |
| --- | ---: |
| Authenticated context read | <= 200 ms |
| Catalog list/detail API warm | <= 400 ms |
| POS availability search warm | <= 300 ms |
| Dashboard server read model | <= 800 ms |
| First-page TTFB cùng region | <= 500 ms |
| Checkout/complete receipt transaction | <= 1.500 ms |
| Client cart/input interaction | <= 100 ms |

Browser release targets:

- LCP p75 <= 1,5 giây trên desktop và <= 2,5 giây trên mobile profile.
- INP p75 <= 200 ms.
- CLS p75 <= 0,1.
- Không blank list trong lúc đổi filter/page; loading state không làm layout jump.

SLO chỉ được đánh giá trên environment gần production, runtime và database cùng
region, với dataset và concurrency profile đã version-control.

## 4. Critical path mới

```text
E1.2 catalog lifecycle hoàn tất
  -> PERF-0 measurement/observability
  -> PERF-1 trusted context round-trip reduction
  -> PERF-2 catalog/dashboard read models và indexes
  -> Performance Gate P0
  -> E2 inventory architecture/schema
  -> mỗi vertical slice sau đó có performance gate riêng
```

PERF-0 có thể bắt đầu song song với phần UI còn lại của E1.2. Không bắt đầu E2
migration cho đến khi PERF-1 và PERF-2 có before/after evidence.

---

## PERF-0 — Đo lường có thể lặp lại

### PERF-0.1 — Request ID và Server-Timing

- [x] Thiết kế helper/wrapper dùng chung cho API response thay vì copy timing
  logic vào từng route.
- [x] Nhận request ID hợp lệ từ trusted proxy hoặc tạo UUID mới; trả lại response
  header và dùng cùng ID trong structured log.
- [x] Instrument tối thiểu `/api/auth/me`, catalog list và catalog detail.
- [x] Timing phase dùng monotonic clock; không đưa raw SQL/input/token vào header.
- [x] Thêm unit tests cho header, phase aggregation và error response.
- [x] Document cách đọc timing bằng curl/browser DevTools.

Implementation note: phase `auth` đo trusted session/context database read; phase
`membership` đo server-side selected-store authorization sau khi context đã được
đọc. Vì vậy task vẫn giữ `[~]` cho đến khi benchmark before/after cùng profile
trong môi trường controlled và phase breakdown đầy đủ.

#### Đọc timing cục bộ

```bash
# Không cần expose cookie/token; request unauthenticated vẫn kiểm tra được
# request-id, status/error path và Server-Timing auth/serialize.
curl -i http://localhost:3000/api/auth/me

# Với session hợp lệ, giữ cookie trong một biến tạm của shell:
curl -i -H 'Cookie: pharmacy_session=<local-session-cookie>' \
  -H 'x-request-id: perf-catalog-001' \
  'http://localhost:3000/api/catalog/products?q=paracetamol&page=1&pageSize=20'
```

Các header cần quan sát:

- `x-request-id`: ID hợp lệ được giữ lại hoặc UUID mới được tạo.
- `server-timing`: các phase `auth`, `repository`, `serialize` tính bằng
  millisecond; không chứa SQL, token hay dữ liệu nghiệp vụ.

Chrome/Edge DevTools: mở Network, chọn request, xem Headers → Response Headers
và Performance → Server Timing. Structured log server có cùng `requestId` để
đối chiếu request với phase timing.

Expected touch points: `src/lib/api-response.ts`, một observability helper mới,
route handlers được đo và tests tương ứng. Không đổi business repository ở task
này để baseline còn so sánh được.

### PERF-0.2 — Benchmark harness và fixture

- [x] Tạo runner tự start production server hoặc nhận base URL rõ ràng.
- [x] Login một lần, giữ cookie trong temp scope và luôn cleanup khi kết thúc.
- [x] Có warm-up phase không tính vào sample.
- [x] Báo latency/status/error/payload cho concurrency 1, 5 và 20.
- [x] Fixture synthetic deterministic có namespace riêng và cleanup/idempotency.
- [x] Chặn seed/load test nhầm database production/shared bằng explicit guard.
- [x] Có runner read-only guarded, login một lần, warm-up và profile concurrency
  1/5/20 trong `scripts/performance/api-benchmark.mjs`.
- [x] Lưu baseline report không chứa secret.

Expected touch points: `scripts/performance/**`, package scripts, fixture docs và
`docs/performance/baseline-<environment>.md` hoặc format report tương đương.

Runner hiện tại:

```bash
npm run build
npm run start
PERF_ENVIRONMENT=local PERF_SAMPLES=10 PERF_WARMUP=2 \
  npm run perf:benchmark
```

Runner chỉ chấp nhận localhost mặc định, không seed hoặc mutate dữ liệu, loại
warm-up khỏi metrics và chỉ ghi origin URL cùng status/latency/Server-Timing vào
report. Với fixture synthetic riêng cần thêm explicit opt-in và namespace/cleanup
trước khi chạy trên database không phải local.

### Thay đổi

- Thêm request ID và `Server-Timing` cho các phase: `auth`, `membership`,
  `repository`, `serialize`; không đưa token, query chứa dữ liệu nhạy cảm hoặc
  patient data vào header/log.
- Thêm benchmark script chạy production build, đăng nhập demo, đo warm-up riêng
  và báo p50/p90/p95/max thay vì chỉ một request.
- Tạo seed/load fixture riêng, synthetic và deterministic:
  - 1.000 StoreProducts.
  - 5.000 StoreSkus.
  - 5.000 local barcodes.
  - Giai đoạn inventory: 20.000 batches, 100.000 movements.
- Profile tải tối thiểu: sequential, concurrency 5 và concurrency 20 trong thời
  gian đủ dài để thấy pool saturation.
- Ghi runtime region, database region, Node/Next version và commit SHA trong report.

### Deliverables

- `scripts/performance/` hoặc công cụ tương đương với lệnh documented.
- Report JSON/Markdown có timestamp và environment label; không commit cookie,
  URL database hoặc credential.
- Một baseline report trước tối ưu và một report sau mỗi PERF increment.

### Exit gate

- Benchmark lặp lại được mà không chỉnh tay source code.
- Metrics tách được app time khỏi database/network time.
- Failure rate và status code được báo cùng latency; request lỗi không được tính
  như request nhanh thành công.

---

## PERF-1 — Trusted request context trong một round-trip

### PERF-1.1 — Single-query context

- [x] Định nghĩa application port trả actor + active memberships/store summary.
- [x] Prisma adapter query từ token hash qua session/user/memberships trong một
  database operation.
- [x] Resolve selected store trong application/domain code, không trong browser.
- [x] Request-local memoization dùng cùng loader cho layout, RSC và API.
- [x] Chuyển catalog, dashboard và stores callers khỏi chuỗi
  `getCurrentUser` + `getActiveMemberships`.
- [x] Đo trước/sau ở tầng database; same-region disposable p95 đạt 20,9 ms và
  trusted context giảm từ 4 xuống 1 SQL statement (auth endpoint tổng 2 xuống 1).

Implementation note: `src/modules/identity/infrastructure/prisma-trusted-request-context.ts`
selects the valid session, actor and active memberships/store summary in one
parameterized PostgreSQL statement. The first controlled capture proved that the
former nested Prisma select was one repository call but four SQL statements;
the corrected adapter is one statement. On the same disposable profile, auth
changed `2 -> 1` total SQL calls and p95 was 20.9 ms. See
`docs/performance/perf-query-count-local.md`.

Expected touch points: identity application/infrastructure, dashboard layout,
catalog routes/read models và tenant/security tests. Không đổi cookie contract.

### PERF-1.2 — Session touch và caller cleanup

- [x] Tách `lastUsedAt` khỏi response critical path nhưng giữ expiry/revocation
  synchronous.
- [x] Touch throttled, best-effort và không làm fail business response.
- [x] Test touch interval, failure behavior và concurrent touch.
- [x] Rà toàn bộ `getCurrentUser`, `getActiveMemberships` và
  `resolveCurrentStoreContext` callers bằng `rg`; không để legacy hot path sót lại.
- [x] So sánh query count và p95 sau migration caller; cùng profile đo được auth
  `2 -> 1`, catalog list `9 -> 6`, detail `11 -> 8` và overview `6 -> 3`, không
  có HTTP error.

Implementation note: trusted context schedules `touchSessionBestEffort` through
Next's `after()` hook. The update is guarded by the previously-read timestamp so
concurrent requests do not continually write; errors are logged as a safe event
and never reject the business response. Legacy synchronous context callers and
the unused two-step store-context adapter have been removed. Controlled
statement-count evidence plus auth/session regression tests close this task;
deployed provider evidence remains PERF-4.1, not a reason to reopen PERF-1.2.

### Vấn đề baseline đã xử lý

Request tenant-scoped đang đi theo chuỗi:

```text
cookie/hash
  -> query AuthSession + User
  -> query Membership + Store
  -> business query
```

Hai query đầu phụ thuộc tuần tự, tạo latency floor lớn khi database remote.
`React.cache` chỉ deduplicate trong cùng server render; không gộp hai round-trip.

### Thay đổi đã áp dụng

- Identity repository/read model đọc bằng session token hash và select actor +
  active memberships + store summary trong **một parameterized SQL statement**.
- Chọn active store từ httpOnly preference cookie trong memory, sau khi membership
  result đã được server xác minh.
- Dùng cùng request-context loader cho layout, Server Component và route handler;
  memoize request-local, không cache session authorization xuyên request.
- Session revocation/expiry vẫn nằm trong query chính.
- `lastUsedAt` không nằm trên critical response path: dùng after-response hook hoặc
  best-effort throttled write có test; không để failure của touch làm fail request.
- Xóa helper cũ chỉ sau khi mọi caller đã chuyển và regression tests đạt.

### Tests

- Revoked/expired session bị từ chối ngay.
- Inactive user/membership/store bị từ chối.
- Selected store không thuộc membership bị từ chối.
- Multi-store selection vẫn đúng.
- Test spy và `pg_stat_statements` chứng minh request context chỉ gọi một
  repository method và phát sinh đúng một database statement.
- Không cache nhầm actor/store giữa hai request.

### Exit gate

- Authenticated context p95 <= 200 ms cùng region hoặc giảm ít nhất 40% so với
  baseline được kiểm soát.
- Catalog API không còn hai auth/membership DB round-trip tuần tự.

---

## PERF-2 — Read model và index theo access pattern

### PERF-2.1 — Catalog hot path

- [x] Ghi contract nhận biết exact SKU/barcode và free-text query.
- [x] Exact lookup dùng normalized equality và index hiện có.
- [x] List dùng `pageSize + 1`; total trở thành optional, UI hiển thị page range
  khi total chưa được yêu cầu.
- [x] DTO/API/TanStack types cùng thay đổi trong một commit.
- [x] Tests cho exact match, hasNextPage, last page và tenant isolation.
- [~] Benchmark fixture trước/sau; current instrumentation proves interactive
  list uses 6 total SQL calls and `includeTotal=true` uses 7 with unchanged
  endpoint payload contract. A historical pre-PERF-2.1 run on the exact profile
  is unavailable, so this criterion remains partial.

Implementation note: `GET /api/catalog/products` no longer runs `COUNT(*)` by
default. Clients may explicitly request `includeTotal=true` for a reporting UX;
interactive search stays on the `pageSize + 1` path. The repository still scopes
every predicate by `storeId` and returns only active products/SKUs.

### PERF-2.2 — Free-text index

- [x] Capture `EXPLAIN (ANALYZE, BUFFERS)` trên fixture, không dùng production data.
- [x] So sánh contract exact SKU/barcode với nhánh free-text theo search UX thực tế.
- [x] Không chọn `pg_trgm` cho fixture hiện tại; provider support/migration được
  giữ lại như một explicit decision point khi dataset vượt ngưỡng.
- [x] Document quyết định chưa thêm index, cùng điều kiện revisit/rollback.
- [x] Test search semantics normalized exact code/barcode và tenant scope.

Implementation note: exact-looking SKU input uses equality on normalized SKU code;
numeric barcode input uses equality on normalized barcode. Name/brand/registration
queries retain free-text behavior. No pg_trgm migration is created until a
fixture-only EXPLAIN and provider capability decision exist.

Current-source evidence: `docs/performance/perf-2.2-explain-local.json` records
the exact 1.000/5.000/5.000 disposable fixture. Exact SKU/barcode use the tenant
composite indexes at `0.046/0.042 ms`; free-text executes in `0.893 ms`, below
the explicit 10 ms current-fixture budget. Reopen the index decision at a
versioned 100.000-product fixture or when warm free-text API p95 exceeds budget.
That future trigger does not keep the present task partial.

### PERF-2.3 — Dashboard aggregate

- [x] Gộp product/SKU/price/barcode counts thành conditional aggregate.
- [x] Recent products là query thứ hai tối đa.
- [x] Giữ repository/application boundary; UI không import Prisma trực tiếp.
- [x] Test mọi predicate có `storeId` và inactive records bị loại.
- [~] So sánh query count, p95 và returned values với implementation cũ; current
  implementation is verified at 2 business reads/3 total SQL calls and values
  have correctness tests. The historical pre-aggregate query-count profile is
  unavailable, so this criterion remains partial.

Implementation note: the aggregate uses parameterized `Prisma.sql` and explicit
store predicates for products, SKUs and barcodes. It intentionally does not read
the ledger; dashboard remains a catalog overview until inventory/sales snapshots
exist.

### Catalog search

- Phân loại query trước khi search:
  - SKU/barcode normalized exact match dùng unique/indexed predicates.
  - Free-text name/registration search dùng normalized searchable field.
- Với free-text chứa chuỗi, đánh giá `pg_trgm` + GIN index bằng `EXPLAIN
  (ANALYZE, BUFFERS)` trên fixture; chỉ tạo migration khi extension/provider đã
  được xác nhận.
- Không chạy `COUNT(*)` cho mọi keystroke. Dùng `take = pageSize + 1` để xác định
  `hasNextPage`; total trở thành optional hoặc query riêng khi UX thật sự cần.
- Chuyển offset sâu sang cursor pagination trước khi catalog/import tăng lớn.
- List DTO không tải field chỉ dùng ở detail; kiểm tra payload và N+1.

### Dashboard

- Gộp bốn SKU/product counts bằng conditional aggregate trong một query.
- Recent products có thể là query thứ hai; tổng dashboard không vượt hai DB
  round-trip sau trusted context.
- Sau khi có inventory/sales, tạo read model theo source of truth; không aggregate
  toàn ledger trong request path.

### Static reference data

- Unit list có thể dùng server cache có version/invalidation rõ vì là shared
  reference data; không áp dụng cache này cho operational tenant data.
- Cache key và invalidation phải có test nếu reference data cho phép mutation.

### Exit gate

- Catalog list/detail warm p95 <= 400 ms trên fixture 1.000/5.000.
- Query plan không sequential-scan không chủ đích trên bảng lớn.
- Dashboard p95 <= 800 ms và tối đa hai business read queries.
- Tenant tests vẫn chứng minh store A/B isolation.

---

## PERF-3 — Render, TanStack Query và bundle

### PERF-3.1 — Query keys và invalidation

- [x] Tạo query-key factory thống nhất cho catalog list/detail/overview/units.
- [x] Khi đổi active store, clear/reset tenant-sensitive namespace trước render.
- [x] Mutation response đủ để update detail cache khi an toàn; chỉ invalidate list
  aggregate cần thiết.
- [x] Kiểm tra không tạo refetch waterfall tuần tự sau add/update/archive SKU;
  source-level `Promise.all` test và Chromium/Firefox lifecycle traces đã có;
  Chromium/Firefox evidence chứng minh mỗi flow chỉ có mutation + một detail GET,
  không refetch list/overview tuần tự.
- [x] Tests cho key factory/store switch và mutation cache behavior phù hợp.

Implementation note: `catalogQueryKeys` is the sole key factory for catalog
queries. Store switching removes the tenant-sensitive `catalog` namespace before
reload; query cache remains a UX optimization and never an authorization source.
SKU update uses a tenant-authorized transaction, mandatory audit reason and
`expectedUpdatedAt` conflict guard before the same three invalidations run in
parallel. Evidence: `docs/performance/perf-3.1-browser-chromium.json` and
`docs/performance/perf-3.1-browser-firefox.json`.

### PERF-3.2 — Client boundary và bundle

- [x] Đo initial compressed JS của home/login/dashboard/catalog trước thay đổi.
- [x] Di chuyển query provider vào authenticated subtree nếu không làm mất cache
  cần thiết hoặc phá hydration.
- [x] Kiểm tra Server Component/client boundary bằng build manifest.
- [x] Đo lại bundle và Web Vitals; không chấp nhận chỉ dựa vào raw file size.

Implementation note: `AppProviders` is no longer mounted in the root layout, so
home/login remain Server Component-only. The authenticated dashboard layout owns
the TanStack Query boundary needed by catalog interactions and hydration.

### PERF-3.3 — Cache consistency foundation

- [x] Đọc và tuân thủ `docs/product/cache-consistency-strategy.md`.
- [x] Bật focus/reconnect refresh cho operational queries, giữ background polling
  tắt theo mặc định.
- [x] Thêm tenant namespace cho operational query keys hoặc provider remount có
  contract tương đương.
- [x] Audit mutation -> affected query keys và sửa invalidation thiếu.
- [x] Test store switch/logout không giữ hoặc flash cache tenant trước.

### PERF-3.4 — Cached dashboard và progressive warmup

- [x] Dashboard overview dùng TanStack Query/API thay vì server repository trên
  mọi return navigation.
- [x] Giữ first visit loading/error/retry và không tạo double fetch.
- [x] Idle-warm overview/catalog hot set có save-data/visibility/concurrency guard.
- [x] Poll overview tối đa mỗi 60 giây khi visible; focus/reconnect refetch khi stale.
- [x] Browser trace chứng minh Dashboard -> Catalog -> Dashboard dùng cache trong
  staleTime và mutation vẫn làm overview hội tụ.
- [x] Không triển khai SSE/outbox trong task này; chỉ ghi evidence nếu polling
  không đủ requirement.

Implementation/evidence note: dashboard home now consumes the workspace already
authorized by the persistent dashboard layout instead of issuing another trusted
context read on each return. Only the Dashboard link opts into full dynamic-route
prefetch; Catalog remains bounded by the existing data warmup. Five warm returns
per browser produced zero overview requests and zero dashboard RSC requests on
click. Chromium control/warm p50 was `161.7/46.1ms`; Firefox was
`168.6/85.0ms`. The mutation trace kept cached count `1` visible during a delayed
refetch, converged to `2` with one overview GET, then archived the test SKU.
Evidence: `docs/performance/perf-3.4-local.md` and linked JSON reports.

### Server/client boundary

- Giữ server-first read model cho catalog page/detail khi đã có initial DTO; riêng
  dashboard overview dùng client query/API để cache return-navigation và tránh
  gọi repository mỗi lần route dynamic được render.
- Không gọi HTTP nội bộ từ Server Component.
- Cân nhắc chuyển `QueryClientProvider` từ root layout vào authenticated app shell
  để login/home không tải TanStack Query khi không dùng.
- Chỉ client hóa component cần tương tác; shell/read-only content giữ server-side.
- Chart, printer và integration adapter sau này phải lazy-load theo route/action.

### TanStack Query

- Chuẩn hóa query-key factory và reset namespace khi đổi active store.
- Dùng `AbortSignal`, debounce và placeholder data như hiện tại.
- Prefetch theo intent (hover/focus/next page), không prefetch toàn list.
- Mutation chỉ invalidate keys liên quan; tránh ba refetch tuần tự khi có thể cập
  nhật detail cache từ response đã commit.
- Không optimistic complete receipt, checkout, reversal hoặc money/stock mutation.

### Bundle gate

- Ghi compressed initial JS/CSS theo route trong performance report.
- Budget ban đầu: route-specific JS tăng không quá 30 KB gzip nếu không có lý do
  và review rõ; lazy-load dependency lớn.
- Dùng browser performance trace/Web Vitals thay vì suy luận UX chỉ từ build size.

---

## PERF-4 — Deployment, pool và tải hệ thống

### PERF-4.1 — Gate gần production

- [x] Runtime/database region được ghi trong report. Deployment hiện cấu hình
  Vercel `icn1` và Supabase `ap-northeast-2`; cấu hình cùng vùng không thay thế
  deployed latency/pool/provider evidence nên gate vẫn là exception.
- [x] Xác nhận runtime pooler/direct migration URL bằng configuration test an toàn
  (`npm run perf:config`).
- [x] Chạy concurrency 1/5/20 với fixture chuẩn và thời lượng đủ ổn định.
- [~] Thu database CPU/connection/wait/slow-query evidence nếu provider cho phép.
  Read-only collector đã ghi connection/wait/cache và `pg_stat_statements` nếu
  extension tồn tại; host CPU vẫn phụ thuộc dashboard/provider.
- [~] Chạy auth, catalog list/detail và dashboard SLO; inventory/POS thêm sau khi có.
  Disposable same-region local gate đã pass; remote-pooler production evidence
  vẫn là exception và overview API có report riêng.
- [x] Nếu SLO không đạt, tạo exception có owner, số đo và remediation deadline;
  không tự đánh dấu gate hoàn thành.

- Deploy runtime cùng region với PostgreSQL; đo trước/sau khi đổi region.
- Xác nhận `DATABASE_URL` dùng runtime pooler và `DIRECT_URL` chỉ cho migration.
- Ghi pool limit, timeout và connection behavior phù hợp với serverless/concurrency;
  không tăng pool mù để che query chậm.
- Theo dõi database CPU, active/waiting connections, slow query và error rate.
- Load gate cho mỗi mutation quan trọng:
  - Receipt complete: idempotency và rollback dưới concurrency.
  - Checkout: hai request tranh tồn cuối chỉ một thành công.
  - Report: range bắt buộc và timeout hữu hạn.
- Chỉ thêm Redis/distributed cache khi measurement chứng minh database/read model
  optimization chưa đủ; MVP không thêm cache infrastructure theo suy đoán.

## 5. Định hướng xử lý legacy

### PERF-L.1 — Legacy cleanup contract

- [x] Xác nhận không còn runtime import Supabase Auth bằng code search/build.
- [x] Ghi owner và removal condition cho `externalAuthId`.
- [x] Thêm migration-chain-from-empty runner vào CI trước khi thêm inventory
  migrations; workflow `quality.yml` chạy chain trên PostgreSQL service và chain
  đã được chạy local trên disposable PostgreSQL.
- [x] Ghi rõ legacy import chưa implemented và route mọi dữ liệu qua staging.
- [x] Chốt browser matrix; không thêm polyfill không có requirement.
- [x] Không sửa/xóa migration hoặc handoff history đã apply/append.

### Auth legacy

- Supabase Auth adapter cũ đang ở trạng thái staged deletion và không còn runtime
  import. Legacy import chưa được triển khai; mọi dữ liệu mới đi qua local
  application-owned identity. Hoàn tất commit boundary để repository không giữ
  trạng thái nửa chuyển đổi.
- `User.externalAuthId` là compatibility field, owner là identity/data migration
  maintainer. Retain until an import audit confirms zero provider-linked records;
  then remove via a new additive migration after a backup/rollback rehearsal. It
  is never the primary local identity.
- Handoff cũ là lịch sử append-only, không xóa; thêm superseding entry khi quyết
  định thay đổi.

### Migration legacy

- Các corrective migration khôi phục tenant FK là lịch sử hợp lệ nếu đã apply;
  không squash hoặc sửa chúng trên shared environment.
- Thêm migration-from-empty test để chứng minh toàn chain chạy được.
- Mọi index/trigram mới dùng migration additive và có rollback/impact note.
- Legacy import chưa được triển khai; nếu phát sinh dữ liệu nguồn cũ, chỉ tiếp nhận
  qua staging/import boundary có namespace và audit, không ghi trực tiếp vào bảng
  operational.

Migration chain check:

```bash
MIGRATION_TEST_DATABASE_URL='postgresql://...empty-test-db...' \
  npm run db:migrate:empty-check
```

The runner refuses `DATABASE_URL` fallback and remote targets without explicit
`PERF_ALLOW_REMOTE=1`; it never runs against the configured application database
by accident.

### Legacy data import

- Hiện mới có policy, chưa có adapter/staging implementation.
- Khi làm import: giữ raw source/reference, idempotency key và preview; không cho
  legacy row tự thành VERIFIED hoặc ghi đè local price/conversion/stock.
- Không đưa dual-read legacy vào transaction checkout/receipt nếu có thể hoàn tất
  migration offline/staged; nếu bắt buộc phải dual-read, ghi ADR và deadline xóa.

### Browser legacy

- Next.js 16/React 19 là modern baseline; Internet Explorer không được hỗ trợ.
- Browser matrix tối thiểu: Chrome và Edge (2 bản stable gần nhất), Firefox (2
  bản stable gần nhất), Safari macOS/iOS (2 bản major gần nhất), Chrome Android
  (2 bản stable gần nhất). Thiết bị màn hình nhỏ và camera barcode phải được
  kiểm tra trên Chrome Android và Safari iOS.
- MVP gate: Chromium và Firefox đã chạy thành công với browser trace/Web Vitals;
  `.github/workflows/quality.yml` chạy lại hai engine trên nhánh `production`
  hoặc workflow dispatch thủ công, không chạy job nặng trên mọi push/PR.
  không thêm polyfill hàng loạt khi chưa có requirement.
- WebKit/Safari được defer khỏi MVP vì host hiện thiếu native dependencies; trước
  public release phải chạy lại bằng CI/container có WebKit dependencies đầy đủ.

## 6. Thứ tự giao việc đề xuất

1. Hoàn tất E1.2 price/conversion/product lifecycle đang dở.
2. PERF-0 instrumentation + reproducible benchmark.
3. PERF-1 single-query trusted context.
4. PERF-2 catalog count/search/dashboard aggregate.
5. Chạy Performance Gate P0 và ghi before/after report.
6. Chỉ khi gate đạt hoặc có exception được ghi rõ mới bắt đầu E2 inventory ADR.

Mỗi PERF task phải giao kèm evidence trước/sau, correctness tests và full
verification. Không chấp nhận “cảm thấy nhanh hơn” hoặc chỉ dựa vào TanStack cache.

## 7.1 Gate disposition hiện tại

### Đã đạt trong MVP scope

- Request ID/Server-Timing, trusted context, session-touch policy và catalog
  read-path optimizations đã có implementation/tests.
- Trusted context đã được kiểm chứng ở tầng PostgreSQL statement, không chỉ bằng
  repository mock: auth `2 -> 1`, catalog list `9 -> 6`, detail `11 -> 8`,
  overview `6 -> 3` trên cùng disposable profile.
- Catalog exact/free-text planning contract đạt trên fixture disposable
  1.000/5.000/5.000; exact paths giữ composite indexes và pg_trgm được defer bằng
  explicit reopen trigger thay vì migration theo suy đoán.
- Catalog add/update/archive SKU lifecycle đã được trace qua UI trên
  Chromium/Firefox; mỗi mutation chỉ refetch active detail đúng một lần và không
  tạo list/overview API waterfall.
- Benchmark + synthetic fixture có guard, cleanup và report JSON không chứa secret.
- Same-region disposable local gate đạt SLO trên fixture 1.000/5.000/5.000;
  Chromium và Firefox browser traces đạt MVP gate.
- Dashboard return-navigation control-vs-warm trace đạt trên Chromium/Firefox;
  cache giữ nội dung, không tạo overview/RSC request trong staleTime và mutation
  hội tụ trong đúng một overview refetch.
- Migration chain từ database rỗng chạy được trong CI; legacy import vẫn staged,
  không có runtime Supabase Auth import.

### Được defer có chủ đích

- WebKit/Safari: chạy trước public release bằng CI/container có native
  dependencies; không chặn MVP.
- Inventory/POS load gates: chỉ mở sau khi ledger, receipt và checkout được
  triển khai, không benchmark endpoint chưa tồn tại.

### Cần external environment trước khi đóng hoàn toàn

- Controlled load trên deployed topology cùng region và provider
  CPU/connection/wait/slow-query telemetry. Historical pre-change query-count
  còn thiếu riêng cho catalog count/dashboard aggregate; current hot-path
  contracts đã có ở `docs/performance/perf-query-count-local.md`.
- Các gate này không được suy luận từ local Docker hoặc remote-pooler sample; cần
  staging/provider access và owner project maintainer trước E2 inventory.

## 7. Mẫu cập nhật sau mỗi task

Agent append report theo format sau vào file performance report và tóm tắt trong
`HANDOFF.md`:

```text
Task: PERF-x.y
Status: complete | partial | blocked
Environment: local/staging, runtime region, database region
Dataset: products/skus/barcodes/batches/movements
Build/commit: ...
Before: p50 / p90 / p95 / max / error rate / n / concurrency
After:  p50 / p90 / p95 / max / error rate / n / concurrency
Query count/plan change: ...
Correctness verification: ...
Files/migration: ...
Remaining risk: ...
Next task: ...
```

## 8. Prompt ngắn để giao agent

```text
Đọc AGENTS.md và toàn bộ required docs, sau đó đọc đầy đủ
docs/product/performance-change-direction.md. Inspect trạng thái code và evidence
thật. Chọn task chưa hoàn thành đầu tiên trong Execution backlog có dependency đã
đạt, thực hiện đúng scope và acceptance criteria của task đó.

Phải đo before/after bằng cùng environment/profile, giữ tenant/session/business
invariants, thêm regression tests, chạy lint/typecheck/test/build và migration
checks nếu có. Chỉ đánh dấu [x] khi evidence và Definition of Done trong plan đạt.
Cập nhật performance report, plan checkbox và append HANDOFF.md. Không thêm cache
hạ tầng, bỏ authorization hoặc làm optimistic stock/money mutation để đạt số đo.
```
