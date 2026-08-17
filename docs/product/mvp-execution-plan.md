# MVP execution plan

Ngày lập: 2026-08-17. Phạm vi này không bao gồm camera scan/OCR.

Tài liệu này là kế hoạch thực thi từ trạng thái repository hiện tại đến một MVP
có thể vận hành và demo. `docs/product/implementation-plan.md` vẫn là checklist
theo domain; tài liệu này bổ sung critical path, thứ tự giao việc, contract dự
kiến, hiệu năng và exit gate cho từng increment.

## 1. Kết quả MVP phải đạt

Một nhà thuốc có thể hoàn thành chuỗi sau bằng dữ liệu synthetic:

```text
đăng nhập và chọn store
  -> hoàn thiện sản phẩm/SKU
  -> tạo và hoàn tất phiếu nhập theo lô
  -> xem tồn khả dụng và cảnh báo hạn dùng
  -> tạo đơn bán
  -> hệ thống xuất FEFO trong transaction
  -> hủy/trả bằng giao dịch bù trừ
  -> xem doanh thu, COGS và lợi nhuận gộp đúng snapshot
```

MVP không đạt nếu chỉ có màn hình hoặc API mock. Tồn phải tái tạo được từ ledger;
COGS phải lấy từ batch allocation; mọi dữ liệu vận hành phải tenant-scoped.

## 2. Baseline hiện tại

Đã có:

- Application-owned auth, session, active store và role policy.
- Global/store catalog foundation, local product/SKU create và audit khi tạo.
- Dashboard/catalog responsive, server-first initial data và TanStack Query cho
  client cache, tìm kiếm, phân trang và prefetch.
- Prisma/PostgreSQL migration foundation và deterministic demo seed.

Chưa đủ để bắt đầu giao dịch kho:

- Product detail và add/update/archive SKU đã có, nhưng product lifecycle và
  chính sách version/lock conversion sau giao dịch vẫn chưa hoàn tất.
- Chưa có Supplier, GoodsReceipt, Batch, StockMovement hay balance projection.
- Chưa có POS, Sale, Payment, FEFO allocation, return/reversal và reporting.
- Chưa có E2E, load baseline hay restore rehearsal.

### Evidence snapshot

The current foundation has been verified with:

```text
npm run lint       ✓
npm run typecheck  ✓
npm test           ✓ 65 tests
npm run build      ✓
```

Prisma migrations are deployed and the database reports an up-to-date schema.
The local demo login still requires a server-only `AUTH_PEPPER` in `.env`; this
is intentionally not committed and is not a reason to fake production metrics.
The dashboard therefore reports catalog-derived counts only and leaves stock,
sales and profit empty until their source-of-truth ledgers exist.

## 3. Nguyên tắc lập kế hoạch

1. Đi theo vertical slice có thể kiểm chứng, không dựng toàn bộ schema rồi mới làm
   UI.
2. Correctness gate của stock/money/tenant phải qua trước UX polish tiếp theo.
3. Server Component tải read model cho first paint; TanStack Query quản lý cache
   và tương tác client sau đó.
4. Không cache chéo store. Query key client không thay thế server authorization.
5. Mutation hoàn tất mới cập nhật/invalidate cache; optimistic update chỉ dùng
   cho thao tác có thể rollback rõ ràng, không dùng cho checkout/complete receipt.
6. Chỉ hiển thị số liệu dashboard khi đã có source of truth tương ứng.

## 4. Critical path

```text
E1 Catalog operational readiness
  -> PERF-0..2 Performance Gate P0
  -> E2 Inventory architecture + schema
  -> E3 Goods receipt vertical slice
  -> E4 Inventory operations + alerts
  -> E5 POS + FEFO + COGS
  -> E6 Return, cancellation + reversal
  -> E7 Reporting + operational dashboard
  -> E8 Production hardening + demo release
```

Catalog import/moderation có thể làm sau E3 hoặc song song bởi contributor khác,
nhưng không được chặn critical path. Camera scan/OCR nằm ngoài kế hoạch này.

Performance Gate P0 và checklist agent được quản lý duy nhất tại
`docs/product/performance-change-direction.md`. Gate này phải đo before/after và
giảm database round-trip trước khi schema inventory làm tải hệ thống phức tạp hơn.

---

## E1 — Catalog operational readiness

### Outcome

StoreProduct và StoreSku đủ ổn định để transaction kho tham chiếu mà không phải
sửa lịch sử về sau.

### Status

- [x] **E1.1 Product detail + add SKU**: product detail read model, tenant-safe
  detail API, transactional add-SKU use case, audit, responsive UI and
  TanStack Query detail cache are implemented and verified.
- [~] **E1.2 Price/conversion policy + archive**: SKU archive is now available
  through responsive UI with tenant checks, mandatory reason, last-active-SKU
  protection and audit. Price/conversion update now has exact input,
  before/after audit and optimistic concurrency; product lifecycle and the
  post-transaction conversion version/lock policy remain pending.

### Backend và data

- Thêm read model product detail tenant-scoped.
- Thêm use case tạo SKU bổ sung cho một StoreProduct.
- Thay đổi giá bán tạo audit với before/after và actor.
- Thay đổi conversion không sửa giá trị đã dùng trong transaction lịch sử; thiết
  kế effective version hoặc khóa conversion sau lần giao dịch đầu tiên.
- Archive product/SKU thay vì hard-delete; từ chối archive khi còn nghiệp vụ đang
  mở cần SKU đó.
- Enforce unique SKU/barcode theo store và chuẩn hóa mã tại application boundary.
- Sửa API error mapping để duplicate/validation trả 409/422 thay vì 503 chung.

### UI

- Trang product detail/edit với các tab tổng quan và SKU.
- Thêm SKU, sửa giá, vị trí kệ, tồn tối thiểu và archive có confirmation.
- Hiển thị rõ global reference, local override và version lệch nếu có.
- Không đưa tồn kho vào trang này trước E3.

### TanStack Query

- Query keys chuẩn hóa: `catalog.list`, `catalog.detail(productId)`, `units.list`.
- Prefetch detail khi focus/hover row trên desktop; không prefetch hàng loạt.
- Mutation sửa product cập nhật cache detail trực tiếp và invalidate list aggregate.
- Mutation SKU/price chờ server commit; rollback cache nếu dùng optimistic update.

### Tests bắt buộc

- Store A không đọc/sửa/archive product hoặc SKU store B.
- Duplicate SKU/barcode trả conflict và không có partial write.
- Price/conversion change có audit an toàn.
- Archived record không xuất hiện trong lookup mặc định.

### Exit gate

- E1.1 exit gate: có thể mở một product từ list, xem detail đúng tenant và thêm
  SKU mới qua UI; duplicate/validation/permission có contract và test.
- Full E1 exit gate: có thể tạo một product với nhiều SKU, sửa giá và archive
  qua UI.
- Product/SKU IDs và conversion đủ ổn định để E3 tham chiếu.
- Lint, typecheck, tests và build sạch; docs/API/HANDOFF cập nhật.

---

## E2 — Inventory architecture và schema

### Outcome

Chốt data model và transaction contract trước khi ghi movement đầu tiên.

### Quyết định phải ghi ADR

- UUID v4 hay v7 cho bảng append-heavy.
- Document number theo store và cách cấp số an toàn khi concurrent.
- Batch identity: SKU + batch number + expiry + receipt line/source.
- Chính sách expiry bắt buộc theo loại hàng; timezone store cho ngày hết hạn.
- Balance projection và cơ chế reconciliation từ ledger.

### Schema dự kiến

| Entity | Trách nhiệm chính |
| --- | --- |
| `Supplier` | Master data tenant-scoped, archive được |
| `GoodsReceipt` | Header, supplier, document number, trạng thái |
| `GoodsReceiptLine` | Snapshot SKU/unit/conversion/quantity/cost/batch/expiry |
| `InventoryBatch` | Lô nhập, expiry, cost snapshot, trạng thái bán |
| `StockMovement` | Ledger bất biến, quantity base, reason/document/actor |
| `InventoryBalance` | Projection đọc nhanh theo store/SKU/batch |

### Database constraints

- Composite tenant foreign keys trên toàn chuỗi receipt -> line -> batch ->
  movement -> balance.
- Quantity và conversion dương; tiền không âm; timestamp UTC.
- Unique document number theo store.
- Unique idempotency key cho complete/cancel command.
- Không cascade-delete completed document, batch hoặc movement.

### Exit gate

- ADR accepted, Prisma schema và migration mới được review.
- `prisma validate/generate` đạt; migration chạy từ database trống và trên trạng
  thái hiện tại mà không sửa migration cũ.
- Test database constraints và tenant relation âm tính.

---

## E3 — Goods receipt vertical slice

### Outcome

Người dùng tạo draft và hoàn tất phiếu nhập; tồn tăng đúng một lần, atomic và có
thể đối soát.

### Use cases

- Create/update receipt draft.
- Add/update/remove draft lines.
- Complete receipt với idempotency key.
- Cancel completed receipt bằng linked reversal.
- Read receipt list/detail và inventory balance.

### Transaction complete

```text
authorize actor/store/role
  -> lock và kiểm tra receipt còn DRAFT
  -> validate mọi line và SKU cùng store
  -> snapshot unit/conversion/cost
  -> create/reuse batch theo policy đã chốt
  -> append RECEIPT movement
  -> update balance projection
  -> mark receipt COMPLETED
  -> append audit
  -> commit
```

Bất kỳ lỗi nào phải rollback toàn bộ. Retry cùng idempotency key trả cùng kết quả,
không tạo thêm movement.

### UI

- Receipt list theo trạng thái/ngày/supplier.
- Editor draft hỗ trợ nhiều dòng, validation tại dòng và tổng tiền exact.
- Review screen trước Complete; nút Complete bị khóa trong khi mutation pending.
- Detail hiển thị batch/movement đã tạo; cancellation bắt buộc lý do.
- Mobile dùng card rows; desktop dùng table nhưng giữ cùng form state.

### TanStack Query và render

- Server-render receipt list/detail lần đầu.
- Debounce product picker; query có pagination và cancellation signal.
- Draft mutation invalidate đúng receipt detail/list; Complete invalidate receipt,
  balances và dashboard inventory keys sau commit.
- Không optimistic Complete/Cancel vì đây là mutation tài chính/tồn kho.

### Tests bắt buộc

- Draft không đổi tồn.
- Complete tạo đúng batch, movement và balance.
- Lỗi giữa transaction không để partial write.
- Complete lặp lại không nhân đôi tồn.
- Cancel tạo reversal và balance quay về đúng giá trị.
- Store/role isolation và audit actor/reason.

### Exit gate

- Demo được `product -> receipt draft -> complete -> inventory balance` trên UI.
- Reconciliation tính từ movement bằng balance projection cho fixtures.
- Regression suite stock/tenant/money đạt.

---

## E4 — Inventory operations và cảnh báo

### Outcome

Nhà thuốc xem được tồn theo sản phẩm/lô và xử lý chênh lệch mà không sửa quantity
trực tiếp.

### Scope

- Inventory list/detail: on-hand, available, batch, expiry, shelf và cost access
  theo permission.
- Adjustment in/out với reason; approval hook cho ngưỡng lớn.
- Damage, loss, expiry và supplier return dùng movement type riêng.
- Batch quarantine/release có audit.
- Low stock, near-expiry và expired read models theo timezone store.
- Reconciliation command/report chỉ đọc ledger và sửa projection có kiểm soát.

### Performance

- Đọc từ `InventoryBalance`, không aggregate toàn bộ movement trong request path.
- Index tenant-first cho list/filter phổ biến.
- Cursor pagination cho movement history; tránh offset sâu.
- TanStack Query dùng placeholder data và filter key ổn định; không poll khi tab
  background. Chỉ refresh keys bị ảnh hưởng sau mutation.

### Exit gate

- Mọi thay đổi tồn đều có immutable movement và audit.
- Không thể làm available stock âm.
- Expired/quarantined batch không xuất hiện như available.
- Balance reconciliation đạt trên fixtures nhiều lô.

---

## E5 — POS, FEFO và COGS

### Outcome

Checkout nhanh nhưng không hy sinh correctness khi hai người bán cùng lô cuối.

### Schema/use cases

- `Sale`, `SaleLine`, `Payment`, `BatchAllocation` và document numbering.
- Cart/draft không đổi tồn.
- Checkout lưu snapshot tên, SKU, unit, conversion, unit price và discount.
- FEFO theo `expiry -> receivedAt -> id`; bỏ expired/quarantined batch.
- Allocation lưu quantity và unit cost snapshot; COGS là tổng allocation.
- Lock/conditional balance update và retry có giới hạn cho conflict.

### POS UI

- Product search keyboard-first, cart luôn thấy tổng quantity/discount/payable.
- Hiển thị available stock và near-expiry nhưng không block thao tác tìm kiếm.
- Chặn checkout khi thiếu tồn; lỗi conflict cho phép refresh/retry có chủ đích.
- Cash/transfer trong MVP; receipt HTML/CSS 58/80 mm.
- Mobile dùng cart drawer hoặc two-step flow, desktop dùng two-column layout.

### TanStack Query

- Cache product availability có thời gian stale ngắn nhưng checkout luôn kiểm tra
  lại trên server.
- Cart là client/form state, không ghi mỗi keystroke lên server.
- Checkout không optimistic. Thành công mới clear cart và invalidate availability,
  sale list, inventory alerts và dashboard keys.

### Tests bắt buộc

- FEFO qua nhiều batch với tie-breaker deterministic.
- COGS exact từ hai batch có cost khác nhau.
- Batch expired/quarantine bị bỏ qua.
- Hai checkout tranh tồn cuối chỉ một thành công.
- Partial payment/movement failure rollback toàn transaction.

### Exit gate

- Demo receipt -> sale cho thấy tồn giảm và COGS đúng.
- Concurrent test chạy trên PostgreSQL thật, không chỉ mock repository.

---

## E6 — Return, cancellation và reversal

### Outcome

Sửa sai mà không mất lịch sử hoặc làm lệch tồn/tiền.

### Scope

- Cancel completed sale tạo payment/movement reversal liên kết record gốc.
- Return tham chiếu sale line và allocation gốc khi truy vết được.
- Hàng trả đủ điều kiện quay đúng batch; hàng không đủ điều kiện vào quarantine
  hoặc damage path.
- Partial return không vượt quantity đã bán trừ các return trước.
- Sensitive action bắt buộc reason và permission.

### Exit gate

- Sale gốc không bị sửa/xóa.
- Tồn, payment và COGS effect đảo đúng cho full/partial return.
- Repeated command idempotent; audit có actor/store/reason/before-after an toàn.

---

## E7 — Reporting và operational dashboard

### Outcome

Dashboard chuyển từ catalog readiness sang số liệu vận hành thật.

### Read models

- Net sales, returns, COGS và gross profit theo ngày store timezone.
- On-hand/available, low stock, near-expiry, expired và batch aging.
- Sale/receipt activity gần đây.
- Audit viewer theo actor/action/target/time.

### Quy tắc

- Financial report dùng transaction snapshot và allocations, không dùng master
  price/cost hiện tại.
- Công thức gross profit được ghi cạnh báo cáo.
- Cost/audit data chỉ trả cho role được phép.
- CSV export áp dụng đúng filter và tenant đang active.

### Performance

- Query aggregate có index và khoảng thời gian bắt buộc.
- Cache client theo store + filter; server vẫn resolve tenant.
- Chart nặng được lazy-load; bảng và KPI chính phải render trước.
- Chỉ cân nhắc materialized view sau khi query plan/load test chứng minh cần thiết.

### Exit gate

- Report khớp fixture receipt -> sale -> return.
- Thay master price không đổi lịch sử.
- Dashboard không còn placeholder và không block first paint vì chart phụ.

---

## E8 — Production hardening và demo release

### Automated verification

- CI: lint, typecheck, unit/integration, build và migration-from-empty.
- Playwright: login -> catalog -> receipt -> inventory -> sale -> return -> report.
- Test restore database vào môi trường kiểm thử.
- Dependency/security review và structured error monitoring.

### Performance budget ban đầu

Đo trên demo data có ít nhất 1.000 products, 5.000 SKUs, 20.000 batches và
100.000 movements; báo cáo p50/p95, không chỉ một lần chạy local.

| Luồng | Budget p95 phía server | UX client |
| --- | ---: | --- |
| Catalog/product search | <= 400 ms | giữ kết quả cũ, input không giật |
| Receipt list/detail | <= 500 ms | first page server-rendered |
| Inventory list | <= 500 ms | filter không blank screen |
| POS availability search | <= 300 ms | cart interaction <= 100 ms |
| Checkout transaction | <= 1.500 ms | trạng thái pending rõ, không double submit |
| Dashboard 30 ngày | <= 800 ms | KPI trước, chart lazy-load |

Budget là mục tiêu đo ở môi trường gần production, không phải assertion unit test.
Nếu không đạt: kiểm tra query plan/index/N+1/payload trước khi thêm cache phức tạp.

### Release gate

- Chỉ dùng synthetic demo data; không có credential/production export trong repo.
- Migration và seed chạy lại được từ database trống.
- Backup restore được chứng minh, không chỉ cấu hình.
- Mobile/desktop hoàn tất luồng E2E; không có link chính dẫn 404.
- README nêu setup, demo account, architecture, limitations và screenshots.

## 5. Quy ước API và cache xuyên suốt

### Command endpoints

- Server tự inject `actorId/storeId`; không nhận chúng làm bằng chứng từ payload.
- Zod validation ở boundary; domain/application kiểm tra state transition.
- Command nhạy cảm nhận `reason` và `idempotencyKey` khi phù hợp.
- Error codes ổn định: validation 422, forbidden 403, conflict/state 409,
  unavailable 503. Không biến domain error thành 500/503 chung.

### Query keys đề xuất

```text
["catalog", "list", storeScopeVersion, filters]
["catalog", "detail", productId]
["receipts", "list", filters]
["receipts", "detail", receiptId]
["inventory", "list", filters]
["inventory", "sku", skuId]
["sales", "list", filters]
["sales", "detail", saleId]
["reports", reportName, period, filters]
```

Không cần đưa raw `storeId` từ browser vào request; `storeScopeVersion` chỉ là
client cache namespace được reset khi đổi store. API luôn resolve store từ
session/cookie server-side.

### Payload discipline

- List DTO chỉ chứa field cần cho list; detail tải riêng.
- Money serialize dạng integer string khi vượt safe integer.
- Decimal quantity serialize string; parse/format ở boundary, không dùng float
  cho domain calculation.
- Phân trang mặc định và giới hạn tối đa bắt buộc trên mọi list.

## 6. Definition of Ready cho một increment

Chỉ bắt đầu increment khi:

- Invariant và state transition liên quan đã rõ.
- Migration/data ownership/tenant chain đã được xác định.
- API command/query DTO và error cases đã liệt kê.
- Acceptance tests có fixture và expected result cụ thể.
- UI không phụ thuộc vào module chưa có source of truth.

## 7. Definition of Done cho một increment

- Có đường đi UI -> application use case -> repository -> PostgreSQL thật.
- Happy path, invalid state, rollback, tenant và authorization đã test.
- Stock/money/audit bug có regression test.
- Không có query N+1 rõ ràng; list phân trang và payload hữu hạn.
- Loading/empty/error/success/disabled state hoạt động trên mobile và desktop.
- Lint, typecheck, tests, build và migration checks đạt.
- Documentation/API contract cập nhật và `HANDOFF.md` có entry append-only.

## 8. Task nên bắt đầu ngay

Thực hiện **E1 Catalog operational readiness**, chia thành hai PR/work package:

1. `E1.1 Product detail + add SKU + tenant/API tests`.
2. `E1.2 Price/conversion policy + archive + audit + responsive UI`.

Sau E1, làm ADR và migration của E2. Không bắt đầu dashboard doanh thu, POS hoặc
reporting trước khi E3 tạo được ledger đúng và có reconciliation test.
