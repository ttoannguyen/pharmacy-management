# Implementation plan

Tài liệu này biến roadmap thành các work package có thể triển khai và kiểm tra
độc lập. Trạng thái phản ánh repository tại ngày 2026-08-17.

## Quy ước trạng thái

- `[x]` hoàn thành và đã verification.
- `[~]` đã có nền móng nhưng chưa đạt Definition of Done.
- `[ ]` chưa làm.
- Chỉ đánh dấu hoàn thành khi code, migration, test và tài liệu liên quan đều đã
  cập nhật.

## Definition of Done chung

Mỗi work package chỉ hoàn thành khi:

1. Business rule được thực thi ở server/domain, không chỉ ở UI.
2. Mọi dữ liệu vận hành được tenant-scope và có authorization test.
3. Schema change có migration; migration shared đã áp dụng thì không chỉnh sửa.
4. Đường đi lỗi được xử lý và không để partial write.
5. Có regression test cho stock, money, tenant, auth và audit.
6. `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` đều đạt.
7. README/docs/API contract và `HANDOFF.md` được cập nhật.

## Trạng thái hiện tại

- [x] Next.js 16, TypeScript, Tailwind, Vitest và Prisma 7 scaffold.
- [x] Supabase runtime/migration connection tách `DATABASE_URL`/`DIRECT_URL`.
- [x] Initial schema và migration cho identity, global/store catalog, barcode,
  submission và audit.
- [x] Deterministic synthetic seed và health endpoint.
- [x] Membership/role schema, active store resolver, membership adapter và
  request-safe store selection đã triển khai.
- [x] Catalog local có repository/use case/API, dashboard read model và UI
  responsive với server-first load cùng TanStack Query cache.

---

## Phase 1 — Identity, active store và application contracts

Mục tiêu: mọi use case tiếp theo nhận tenant và actor từ trusted server context.

### P1.1 Application-owned authentication

- [~] Password login, session cookie, local user/session tables và protected route
  đã có; chỉ còn live-verify với demo credentials sau khi đặt `AUTH_PEPPER`.
- [x] Passwords dùng Argon2id; không lưu plaintext.
- [x] Session là opaque random token, DB chỉ lưu SHA-256 token hash.
- [x] Session revoke/expiry và persistent login rate-limit đã có.
- [x] Có login/logout/me routes và protected dashboard.
- [x] Có provider-independent tests cho password và auth context; không phụ thuộc
  dịch vụ auth bên ngoài.

### P1.2 Active store context

- [x] Resolve `actorId`, `storeId`, role từ session và Membership còn hiệu lực.
- [x] Không nhận `storeId` từ request làm bằng chứng quyền truy cập; selection luôn
  kiểm tra lại membership ở server.
- [x] Có API và dashboard flow chọn store nếu user thuộc nhiều store.
- [x] Trả lỗi thống nhất cho unauthenticated, forbidden và inactive membership.

### P1.3 Authorization policy và API contract

- [x] Policy helper cho owner, pharmacist, inventory staff, accountant và admin.
- [x] Standard error/response contract cho route handlers.
- [x] Zod DTO ở application boundary cho store selection và auth input.
- [x] Tenant isolation tests giữa store A và store B.

### Acceptance criteria

- User store A không đọc/sửa resource store B dù tự thay ID trong request.
- Role không phù hợp nhận forbidden trước mutation.
- Auth provider có thể mock trong unit/integration test.
- Demo seed không được coi là session production mặc định.

---

## Phase 2 — Catalog vertical slice

Mục tiêu: hoàn thiện luồng `local barcode -> verified global barcode -> not found`.

### P2.1 Repository ports và Prisma adapters

- [x] Store catalog repository luôn yêu cầu `storeId`.
- [x] Shared catalog repository chỉ trả global barcode `VERIFIED` ở lookup mặc định.
- [x] Search có pagination theo tên, hoạt chất, số đăng ký và barcode.
- [x] Chuẩn hóa query string và barcode nhưng vẫn giữ raw input cho audit/debug.

### P2.2 Barcode lookup use case

- [x] Kết quả discriminated union: `LOCAL_MATCH`, `GLOBAL_MATCHES`, `NOT_FOUND`.
- [x] Local exact match luôn ưu tiên.
- [x] Nhiều global match phải trả danh sách; không tự chọn.
- [ ] External provider lỗi không chặn local/manual workflow.
- [x] Unit test cho local/global/not-found, normalization và tenant repository
  boundary.

### P2.3 Create/link/override store product

- [x] Tạo StoreProduct độc lập khi chưa có global record.
- [x] Link StoreProduct/StoreSku tới RegisteredProduct sau xác nhận.
- [x] Validate base unit và `quantityInBaseUnit > 0`.
- [x] Giá dùng integer minor unit.
- [x] Lưu `basedOnGlobalVersion` và explicit override fields.
- [~] Create/link có AuditLog và actor; UI/use case sửa giá, conversion và quản lý
  vòng đời SKU vẫn cần hoàn thiện trước inventory.

### P2.4 UI catalog và scanner input

- [x] Trang danh mục responsive có search theo tên/SKU/mã, phân trang và
  quick-create; first page được server-render và hydrate vào TanStack Query.
- [x] Barcode input hỗ trợ USB/Bluetooth scanner như keyboard input.
- [ ] Camera scanner adapter đứng sau interface; có fallback nhập tay.
- [ ] Không match thì mở quick-create với barcode được điền sẵn.
- [ ] Global match yêu cầu xác nhận unit, conversion và price trước khi tạo local SKU.

E1.1 đã bổ sung product detail tenant-scoped, API thêm SKU và UI thêm SKU. Việc
sửa giá, thay đổi conversion, archive và lifecycle policy được giữ lại cho E1.2;
không đánh dấu toàn bộ P2.3 hoàn thành sớm.

### Acceptance criteria

- Quét `DEMO000001` tại demo store trả local match.
- Barcode chỉ có ở global verified trả suggestion, chưa tự tạo local product.
- Store B không nhìn thấy local match của store A.
- Not found không gọi OCR bắt buộc và luôn cho nhập tay.

---

## Phase 3 — Catalog import và moderation

Mục tiêu: làm đầy dữ liệu có provenance mà không làm bẩn catalog chung.

### P3.1 Import staging

- [ ] Models/migration cho ImportJob, ImportRow và resolution status.
- [ ] CSV/XLSX template theo tài liệu data strategy.
- [ ] Parse thành raw payload, normalize, validate và preview.
- [ ] Idempotency key theo source/import/row.
- [ ] Tải báo cáo lỗi theo dòng.

### P3.2 Entity resolution

- [ ] Match theo official ID, registration number, package rồi mới barcode.
- [ ] Fuzzy name chỉ tạo candidate, không auto-merge.
- [ ] Review queue cho duplicate/conflict.
- [ ] Import không ghi đè local price, conversion, batch hoặc stock.

### P3.3 Catalog submission moderation

- [ ] Store tạo CatalogSubmission kèm ảnh/source.
- [ ] Reviewer approve, reject hoặc merge có audit.
- [ ] Approved record relink local product nhưng không đổi dữ liệu vận hành.
- [ ] OCR chỉ là suggestion với confidence/source.

### Acceptance criteria

- Import cùng file hai lần không nhân đôi entity.
- Một row lỗi không tạo partial catalog write khi commit theo batch atomic.
- Dữ liệu synthetic/OCR không thể thành VERIFIED nếu không qua review.

---

## Phase 4 — Procurement và inventory ledger

Mục tiêu: nhập kho theo lô và tạo tồn truy vết được.

### P4.1 UUID decision cho append-heavy tables

- [ ] Viết ADR chọn UUID v4 hay UUID v7 cho StockMovement/Audit append-heavy.
- [ ] Nếu chọn v7, dùng một generator nhất quán và test định dạng/thứ tự.
- [ ] Không thay mã nghiệp vụ bằng UUID.

### P4.2 Supplier và goods receipt

- [ ] Supplier tenant-scoped.
- [ ] GoodsReceipt trạng thái `DRAFT`, `COMPLETED`, `CANCELLED`.
- [ ] ReceiptLine snapshot SKU, unit, conversion, quantity và purchase price.
- [ ] Batch number và expiry bắt buộc theo chính sách sản phẩm.
- [ ] Draft không tác động tồn.

### P4.3 Batch, movement và balance projection

- [ ] InventoryBatch, StockMovement và InventoryBalance migrations.
- [ ] Movement immutable sau commit.
- [ ] Hoàn tất receipt tạo batch, receipt movement và balance trong một transaction.
- [ ] Cancel completed receipt dùng reversal, không xóa movement.
- [ ] Reconciliation service tính lại balance từ ledger.
- [ ] Composite tenant FK cho mọi chuỗi store-owned.

### P4.4 Inventory operations

- [ ] Stock count và adjustment có reason/actor.
- [ ] Damage, loss, expiry và supplier return là movement type riêng.
- [ ] Cảnh báo low stock, near expiry, expired và long-held.
- [ ] Không cho available stock âm.

### Acceptance criteria

- Transaction lỗi ở bất kỳ bước nào không để receipt completed một phần.
- Balance projection bằng tổng ledger.
- Không sửa trực tiếp quantity để điều chỉnh tồn.
- Batch hết hạn/quarantine không được coi là available.

---

## Phase 5 — POS, FEFO và COGS

Mục tiêu: bán hàng đúng tồn, đúng lô và đúng giá vốn.

### P5.1 Sale domain

- [ ] Sale, SaleLine, Payment và trạng thái draft/completed/cancelled.
- [ ] Snapshot product/SKU/unit/conversion/price/discount trên SaleLine.
- [ ] Số đơn dễ đọc theo store, UUID vẫn là internal ID.
- [ ] Tiền mặt/chuyển khoản; split payment để sau nếu chưa cần.

### P5.2 FEFO allocation

- [ ] Chọn expiry sớm nhất, sau đó receivedAt và ID làm tie-breaker.
- [ ] Bỏ qua expired/quarantined batch.
- [ ] Một SaleLine có thể phân bổ nhiều batch.
- [ ] Lock/conditional update ngăn hai checkout bán lô cuối.
- [ ] Retry có giới hạn cho serialization/deadlock phù hợp.

### P5.3 COGS, return và reversal

- [ ] BatchAllocation lưu quantity và cost snapshot.
- [ ] COGS là tổng allocation, không dùng last purchase price.
- [ ] Return tham chiếu sale line/allocation gốc khi có thể.
- [ ] Hàng trả không đủ điều kiện bán đi quarantine/damage path.
- [ ] Cancel/refund tạo compensating records và audit.

### P5.4 POS UI và receipt

- [ ] POS responsive, keyboard-first, tìm tên/hoạt chất/barcode.
- [ ] Cảnh báo out-of-stock/near-expiry mà không làm chậm thao tác.
- [ ] Receipt HTML/CSS cho 58/80 mm.
- [ ] Camera scan là progressive enhancement, luôn có manual input.

### Acceptance criteria

- Concurrent checkout lô cuối chỉ một transaction thành công.
- COGS đúng khi sale lấy từ hai batch có giá nhập khác nhau.
- Hủy/trả không xóa lịch sử và tồn được đảo đúng.

---

## Phase 6 — Reporting, audit và operations

### P6.1 Financial reports

- [ ] Net sales, COGS, returns và gross profit có công thức/document rõ.
- [ ] Group theo ngày, ca, nhân viên và nhóm hàng.
- [ ] Ranh giới ngày dùng timezone store; database timestamp dùng UTC.
- [ ] Reconcile report với transaction/batch allocation samples.

### P6.2 Inventory reports

- [ ] On-hand/available theo sản phẩm, SKU và batch.
- [ ] Near expiry, expired, low stock, fast/slow-moving.
- [ ] Export CSV phù hợp dữ liệu đang filter.

### P6.3 Audit viewer

- [ ] Filter theo actor, action, target, store và thời gian.
- [ ] Before/after được redact; không chứa secret/token.
- [ ] Sensitive action bắt buộc reason.

### Acceptance criteria

- Report totals khớp fixture/reference calculation.
- User không xem audit/report store khác.
- Thay master price không làm đổi báo cáo lịch sử.

---

## Phase 7 — Production hardening và CV demo

### P7.1 Automated verification

- [ ] CI lint, typecheck, unit/integration test và build.
- [ ] Playwright: login -> receipt -> sale -> return -> report.
- [ ] Test migration từ database trống.
- [ ] Load test barcode search và checkout ở mức MVP.

### P7.2 Security và operations

- [ ] Rate limiting cho auth/search/import endpoints phù hợp.
- [ ] Structured logs, request ID và error monitoring.
- [ ] Backup schedule và restore rehearsal.
- [ ] Dependency/security review.
- [ ] Rà soát quy định Việt Nam trước production thật.

### P7.3 Portfolio delivery

- [ ] Public demo chỉ có synthetic data.
- [ ] README có architecture diagram, screenshots và demo credentials an toàn.
- [ ] Seed reset workflow.
- [ ] CV bullet và case study nêu tenant isolation, FEFO, ledger, COGS và tests.

### Acceptance criteria

- Một người mới clone repo có thể chạy theo README.
- Demo end-to-end hoạt động trên mobile và desktop.
- Backup được restore thành công vào môi trường kiểm thử.

## Thứ tự triển khai khuyến nghị

```text
P1 identity/context
  -> P2 catalog vertical slice
  -> P4 receipt/inventory
  -> P5 POS/FEFO/COGS
  -> P6 reports
  -> P7 hardening/demo

P3 import/moderation có thể bắt đầu sau P2 và chạy song song về mặt sản phẩm,
nhưng không được làm chậm vertical slice receipt -> sale.
```

Task tiếp theo: hoàn tất phần còn lại của **E1.2 price/conversion/product
lifecycle**, sau đó thực hiện **PERF-0 -> PERF-2 Performance Gate P0** theo
`docs/product/performance-change-direction.md` trước khi tạo schema inventory.
