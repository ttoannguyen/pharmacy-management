# Cache consistency, refresh và progressive warmup

Ngày lập: 2026-08-17. Tài liệu này mô tả contract dữ liệu; checklist thực thi duy
nhất vẫn nằm tại `docs/product/performance-change-direction.md`.

Trạng thái triển khai ngày 2026-08-17: **C1 và C2 hoàn tất** bằng code/test cùng
control-vs-warm browser trace trên Chromium/Firefox; C3 (freshness ngoài
client/realtime) chưa mở. Cache vẫn chỉ là read optimization, không phải nguồn sự
thật hay cơ chế ủy quyền.

## 1. Mục tiêu

- Quay lại dashboard/catalog phải hiển thị dữ liệu cache ngay khi còn hợp lệ.
- Dữ liệu cache phải hội tụ về database sau mutation, focus/reconnect hoặc thay
  đổi từ người dùng khác.
- Cache hỏng, hết hạn hoặc bị xóa không được làm mất dữ liệu nghiệp vụ.
- Không hiển thị dữ liệu store trước sau khi đổi tenant.
- Không làm tăng tải bằng cách preload mọi module ngay khi đăng nhập.

## 2. Invariant bắt buộc

```text
PostgreSQL = source of truth
Server authorization = access decision
TanStack Query = disposable client read cache
Next Router Cache = route/RSC optimization
```

Xóa browser cache chỉ có thể làm UI tải lại; không được làm mất product, receipt,
stock movement, sale, payment hoặc audit record. Mọi mutation phải commit ở server
trước khi client cập nhật/invalidate cache.

Không persist mutation queue cho stock/money/role/audit. Offline checkout hoặc
complete receipt bị cấm vì server không thể bảo đảm concurrency/inventory.

## 3. Audit trạng thái hiện tại

### Đang có

- `QueryClientProvider` sống trong dashboard layout nên cache tồn tại khi chuyển
  giữa các route con của dashboard.
- Query key catalog có namespace `['store', storeScope, 'catalog', ...]`; đổi
  store xóa common root trước reload để không flash cache tenant cũ.
- Catalog list/detail có `staleTime = 60s`, `gcTime = 10m`, AbortSignal, debounce,
  placeholder data, focus/reconnect refresh và next-page/detail prefetch.
- Dashboard overview dùng API + `useQuery`, `staleTime = 30s`, polling 60 giây
  khi tab visible, skeleton/error/retry; server page không còn gọi repository
  overview trên mỗi return navigation.
- Add/archive SKU, create/update product invalidate detail, list và overview theo
  đúng namespace; invalidations chạy song song.
- Sau shell interactive, idle warmup tối đa hai query (overview + catalog page 1),
  bỏ qua tab hidden và `saveData`.
- API overview tenant-scoped đã tồn tại.

### Khoảng trống còn lại

- Chưa có event channel cho thay đổi từ tab/user/process khác.
- Không có persisted query cache; đây là chủ ý an toàn cho MVP.

PERF-3.4 đã chứng minh năm lần `Dashboard -> Catalog -> Dashboard` trên mỗi
browser không tạo overview request hoặc dashboard RSC request lúc click trong
`staleTime`; mutation giữ cache cũ khi refetch và hội tụ bằng đúng một overview
GET. Xem `docs/performance/perf-3.4-local.md`.

Theo TanStack Query, stale queries có thể refetch khi mount, window focus hoặc
network reconnect; inactive queries được giữ trong memory rồi garbage collect.
Các hành vi này được điều khiển bằng `staleTime`, `gcTime`,
`refetchOnWindowFocus`, `refetchOnReconnect` và `refetchInterval`.
[TanStack Query important defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults),
[useQuery reference](https://tanstack.com/query/latest/docs/framework/react/reference/useQuery).

## 4. Chính sách cache đề xuất

| Read model | staleTime | gcTime | Refresh | Persist browser |
| --- | ---: | ---: | --- | --- |
| User/store/permissions | Không dùng client cache làm authority | — | Server mỗi request | Không |
| Dashboard overview | 30 giây | 10 phút | mount, focus, reconnect; polling 60 giây khi visible | Không |
| Catalog list | 60 giây | 10 phút | mount nếu stale, focus, reconnect | Không |
| Product detail | 60 giây | 10 phút | mount nếu stale, focus, reconnect | Không |
| Units/reference | 24 giờ hoặc versioned | 24 giờ | invalidate khi admin đổi | Cân nhắc sau |
| Inventory availability tương lai | 5–10 giây | 5 phút | focus/reconnect; polling khi POS visible | Không |
| Report | 60 giây | 10 phút | explicit filter/refresh | Không |

`refetchIntervalInBackground` giữ `false`. Background tab không được liên tục
poll database. Polling chạy khi query có observer và tab đang hoạt động; polling
độc lập với `staleTime`.
[TanStack Query polling](https://tanstack.com/query/latest/docs/framework/react/guides/polling).

Không bật persisted query cache toàn cục trong MVP. Nếu sau này persist reference
data, phải có `maxAge`, build/schema `buster`, tenant namespace và logout cleanup;
TanStack persistence có lifecycle/gcTime riêng cần cấu hình đồng bộ.
[TanStack persistQueryClient](https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient).

## 5. Quy tắc mutation để không mất hoặc ghi đè dữ liệu

### Mọi mutation

1. Client gửi command một lần; UI khóa double submit.
2. Server resolve actor/store, validate state và chạy transaction.
3. Server trả success chỉ sau commit.
4. `onSuccess` dùng response đã commit để cập nhật cache an toàn hoặc targeted
   invalidate.
5. Query active refetch snapshot từ server; cache không tự suy diễn business rule.
6. Error giữ cache cũ, hiển thị lỗi và cho retry có chủ đích.

### Optimistic update

Chỉ cho phép với preference/local UI state hoặc mutation dễ rollback và không ảnh
hưởng stock/money/authorization. Nếu dùng phải cancel in-flight query, snapshot
cache, rollback `onError`, rồi invalidate `onSettled`.

Không optimistic:

- Complete/cancel receipt.
- Checkout, return, refund.
- Stock adjustment/quarantine.
- Price/conversion khi đã có transaction reference.
- Role/permission và sensitive audit action.

Targeted invalidation sau mutation là pattern chính thức của TanStack Query: nó
đánh dấu query stale và background-refetch query đang active.
[TanStack query invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation),
[invalidations from mutations](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations).

### Concurrency/version conflict

- Master data nên trả `updatedAt` hoặc version trong detail DTO.
- Update command gửi expected version khi lost-update có hậu quả; server trả 409
  nếu record đã đổi, client refetch và yêu cầu người dùng reconcile.
- Inventory/sales dùng state transition/idempotency/locking ở server; client
  version không thay thế database constraint.

## 6. Khi database thay đổi ngoài tab hiện tại

Áp dụng theo bốn cấp, chỉ nâng cấp khi cấp trước không đủ.

### Cấp A — Cùng mutation client

- Mutation success invalidate đúng query keys.
- Update detail cache bằng server response nếu DTO đầy đủ.
- Overview/list aggregate refetch background.

Đây là bắt buộc và phải hoàn thiện trước mọi realtime work.

### Cấp B — Tab khác hoặc người dùng quay lại

- Bật `refetchOnWindowFocus: true` cho operational queries.
- Giữ `refetchOnReconnect: true`.
- Refetch on mount chỉ khi stale.
- Dashboard polling 60 giây khi visible; POS availability 5–10 giây khi POS active.

Đây là lựa chọn MVP: đơn giản, phục hồi được missed event và không cần connection
realtime lâu dài.

### Cấp C — Multi-user gần realtime

Khi polling không đáp ứng:

```text
committed domain mutation
  -> server event/SSE adapter
  -> event { storeScope, entity, id, version, action }
  -> client xác nhận active store
  -> invalidate query key
  -> refetch authoritative snapshot
```

- Browser không subscribe trực tiếp database nếu chưa có RLS/security boundary
  tương đương trusted server context.
- Event không chứa price/cost/personal data không cần thiết.
- Event chỉ là invalidation hint; không phải source of truth.
- Reconnect luôn chạy catch-up refetch vì event có thể bị miss.

### Cấp D — Durable outbox

Receipt/sale/report integration cần durable event thì ghi outbox trong cùng
business transaction. Worker publish sau commit và retry idempotently.

PostgreSQL `LISTEN/NOTIFY` có thể dùng làm wake-up signal nhưng listener mất khi
session kết thúc và có race lúc bắt đầu listen; tài liệu PostgreSQL khuyến nghị
listen/commit rồi đọc initial state trước khi dựa vào notification. Vì vậy nó
không thay thế outbox hoặc catch-up query.
[PostgreSQL LISTEN](https://www.postgresql.org/docs/current/sql-listen.html),
[PostgreSQL NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html).

## 7. Progressive warmup theo pattern

Không tải tất cả module khi login. Chia thành hot set:

### Bootstrap bắt buộc

- Session, user, active store, role/permission.
- Code/shell route đang mở.

### Idle warmup sau khi shell interactive

- Dashboard overview: nhỏ và xác suất quay lại cao.
- Catalog page 1 nếu role được truy cập.
- Units/reference nếu form catalog có khả năng mở.

Điều kiện:

- Dùng `requestIdleCallback` hoặc timeout fallback.
- Không chạy khi `navigator.connection.saveData` bật.
- Tối đa 1–2 request đồng thời.
- Không thêm work khi tab hidden hoặc navigation đang diễn ra.

### Intent warmup

- Hover/focus/touch-intent menu: `router.prefetch(route)` và
  `queryClient.prefetchQuery(dataOptions)`.
- Hover product row: prefetch đúng detail như hiện tại.

TanStack prefetch dùng `staleTime` để không fetch lại data còn fresh và query
không được dùng sẽ bị GC theo `gcTime`.
[TanStack prefetching](https://tanstack.com/query/latest/docs/framework/react/guides/prefetching).

Next.js tự prefetch link production, nhưng dynamic routes mặc định chỉ prefetch
đến loading boundary; click vẫn có server round-trip.
[Next.js prefetching](https://nextjs.org/docs/app/guides/prefetching).

### Không preload

- Audit history, report range lớn.
- Product/batch/sale detail chưa có intent.
- Cost/finance data cho role không cần.
- Toàn bộ inventory hoặc catalog.
- Bất kỳ mutation command nào.

## 8. Tenant isolation trong cache

Query key operational phải có tenant cache namespace:

```text
["store", storeScopeVersion, "catalog", "products", filters]
["store", storeScopeVersion, "catalog", "overview"]
```

`storeScopeVersion` có thể là active store ID hoặc opaque version dùng cho client
namespace; nó không phải authorization proof. API vẫn tự resolve active store.

Khi đổi store/logout/session invalid:

1. Cancel tenant queries đang chạy.
2. Remove toàn bộ tenant namespace.
3. Đổi cookie/session ở server.
4. Remount provider hoặc navigate/refresh.
5. Không render previous-store data trong transition.

## 9. Thay đổi nên làm tiếp theo

### Increment C1 — Cache consistency foundation

- [x] Bật focus/reconnect refresh cho operational queries.
- [x] Chuẩn hóa query options/query-key factory có tenant namespace.
- [x] Audit mọi catalog mutation và map query keys bị ảnh hưởng.
- [x] Thêm tests store switch và invalidation mapping.

### Increment C2 — Cached dashboard overview

- [x] Tạo `overviewQueryOptions` và `useCatalogOverview` dùng API hiện có.
- [x] Dashboard render cache ngay khi quay lại; first visit có skeleton/error/retry.
- [x] Bỏ server repository fetch trên return navigation; dùng một API query có
  dedupe với idle warmup.
- [x] Add idle warmup overview/catalog page 1 và intent prefetch detail.
- [x] Browser trace `Dashboard -> Catalog -> Dashboard` không gọi overview lại
  trong staleTime.
- [x] Catalog mutation làm overview stale/refetch đúng.

### Increment C3 — Freshness ngoài client

- Dashboard polling 60 giây khi visible.
- Visibility/focus/reconnect integration tests.
- Đo request volume trước/sau.
- Chỉ thiết kế SSE/outbox sau khi có multi-user freshness requirement cụ thể.

## 10. Acceptance criteria

- Quay lại dashboard trong 30 giây hiển thị cache ngay, không blank loading.
- Sau 30 giây hoặc khi invalidated, cache cũ vẫn hiển thị trong lúc background
  refetch; success cập nhật UI.
- Thay đổi catalog từ cùng client cập nhật dashboard không quá một refetch cycle.
- Thay đổi từ tab/user khác hội tụ trong tối đa 60 giây hoặc ngay khi focus lại.
- Đổi store/logout không flash dữ liệu store trước.
- Cache bị clear/reload không mất dữ liệu database.
- Không tăng request nền khi tab hidden.
- Benchmark và DB query count chứng minh warm navigation nhanh hơn mà không tạo
  polling storm.

## 11. Lệnh verification cho C1/C2

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run perf:browser
```

`perf:browser` ghi `returnNavigation.controlFullReload` và
`returnNavigation.warmClientReturn`: control dùng full reload, còn warm dùng
client-side transition thật giữa Catalog và Dashboard. Mỗi warm sample phải có
`overviewRequestsPerSample = 0`, không có dashboard RSC request lúc click, vẫn
thấy cached metric và nhanh hơn median control. Phần `mutation` phải giữ cached
count trong refetch, tăng đúng một SKU bằng một overview GET và archive fixture
sau đo.
