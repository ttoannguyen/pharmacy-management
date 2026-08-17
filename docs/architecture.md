# Kiến trúc hệ thống

## Mục tiêu

Kiến trúc phải giúp một nhóm nhỏ ship MVP nhanh nhưng vẫn bảo vệ được các phần
khó nhất của sản phẩm: tenant isolation, quy đổi đơn vị, tồn kho theo lô, FEFO,
giá vốn và audit.

## Kiểu kiến trúc

Sử dụng modular monolith trong một ứng dụng Next.js. UI, route handlers/server
actions và domain services có thể cùng repository/deployment, nhưng ranh giới
domain phải rõ ràng.

```text
Browser / PWA
    |
Next.js UI and application boundary
    |
Application services / use cases
    |
Domain modules and policies
    |
Repositories / Prisma
    |
PostgreSQL
```

Không đưa business rule quan trọng vào React component hoặc chỉ kiểm tra ở
client. Client validation cải thiện UX; server và database mới là nơi đảm bảo
tính đúng đắn.

## Module đề xuất

```text
src/modules/
  identity/          users, sessions, memberships, roles
  stores/            pharmacies, branches, settings
  catalog/           global catalog, store catalog, units, barcodes
  procurement/       suppliers, purchase orders, goods receipts
  inventory/         batches, movements, balances, FEFO allocation
  sales/             carts, sales, returns, payments, receipts
  reporting/         revenue, COGS, gross profit, expiry and stock reports
  audit/             security and business audit trail
  integrations/      national drug DB, OCR, object storage, printing
```

Mỗi module nên tách tối thiểu:

```text
domain/          entities, value objects, policies, invariants
application/     use cases and transaction orchestration
infrastructure/  Prisma repositories and external adapters
presentation/    route handlers/server actions and DTO mapping
```

Không bắt buộc tạo đủ folder khi module còn nhỏ, nhưng chiều phụ thuộc phải giữ:

```text
presentation -> application -> domain
infrastructure implements ports owned by application/domain
```

## Ranh giới dữ liệu

### Định danh

- Primary key và foreign key nội bộ dùng PostgreSQL UUID.
- UUID không thay thế mã nghiệp vụ: mã nhà thuốc, SKU, số đăng ký, số phiếu và số
  hóa đơn có field/quy tắc riêng.
- Foundation hiện dùng UUID v4. Trước khi thêm các bảng append-heavy như
  StockMovement, cần đánh giá UUID v7 theo khả năng hỗ trợ của runtime/database;
  nếu đổi phải áp dụng nhất quán và ghi ADR.

### Dữ liệu chung

- Drug concept, ingredient, manufacturer.
- Registered product và lịch sử phiên bản.
- Package và barcode chung đã xác minh.
- Đơn vị, dạng bào chế, đường dùng và nhóm thuốc chuẩn.

### Dữ liệu nhà thuốc

- Store product, SKU, tên hiển thị và local override.
- Giá nhập, giá bán, vị trí kệ, tồn tối thiểu.
- Barcode nội bộ và quy đổi đơn vị.
- Nhà cung cấp, lô, tồn kho và stock movement.
- Đơn bán, thanh toán, ca và báo cáo vận hành.

Giá, tồn kho và lô không bao giờ thuộc global catalog.

## Multi-tenancy

MVP dùng shared database/shared schema với `storeId` trên dữ liệu vận hành.

- Active store lấy từ authenticated membership.
- Mọi query dữ liệu vận hành phải scope theo store.
- Unique constraint của dữ liệu riêng thường phải bao gồm `storeId`.
- Không dựa vào filter của frontend để cách ly dữ liệu.
- Test phải chứng minh user của store A không đọc hoặc sửa store B.

Nếu có nhiều chi nhánh sau này, thêm `organizationId` và `locationId`; không dùng
`storeId` với ý nghĩa mơ hồ cho cả pháp nhân và kho vật lý.

## Hai cấp quản trị

```text
User.systemRole = SYSTEM_ADMIN
  -> control plane toàn nền tảng
  -> user/store/global catalog/system audit

Membership.role = OWNER
  -> admin của đúng store membership
  -> catalog local/inventory/sales/finance/store users
```

System admin không được biến thành membership giả và không tự bypass tenant.
Muốn vận hành trong một nhà thuốc, tài khoản vẫn cần membership hoặc một flow
support access riêng có thời hạn, lý do và audit.

## Transaction boundaries

Các use case sau phải atomic:

- Hoàn tất phiếu nhập và tạo batch/movement.
- Hoàn tất đơn bán, phân bổ batch, xuất kho và ghi payment.
- Trả hàng và hoàn nhập đúng batch khi có thể truy vết.
- Hủy giao dịch và tạo movement/payment đảo ngược.
- Kiểm kho và tạo adjustment.
- Merge hoặc relink catalog có ảnh hưởng nhiều record.

Concurrency cho lô cuối phải được xử lý bằng database transaction, conditional
update/locking và retry phù hợp; không dựa trên kết quả kiểm tra tồn trước đó ở UI.

## Read models và báo cáo

Stock movement là source of truth. Có thể tạo bảng balance/materialized view để
đọc nhanh, nhưng phải tái tạo được từ ledger và cập nhật trong cùng transaction.

Báo cáo doanh thu và giá vốn dựa trên transaction lines cùng batch allocations,
không dựa trên giá bán hay giá nhập hiện tại của master data.

Authenticated dashboard layout resolves the trusted workspace once and passes a
minimal store/membership summary to its persistent client provider. Child home
content consumes that context on client return-navigation instead of querying
identity again; direct entry still crosses the server layout guard, and every API
continues to authorize from the session. Full dynamic-route prefetch is limited
to the small Dashboard home route, not data-heavy operational routes.

## External integrations

Tất cả tích hợp đi qua interface/adapter:

- NationalDrugCatalogProvider.
- BarcodeLookupProvider.
- OcrProvider.
- ObjectStorageProvider.
- ReceiptPrinterProvider.
- ElectronicInvoiceProvider.

Quét hoặc nhập hàng phải tiếp tục hoạt động khi nguồn tra cứu không thiết yếu bị
lỗi. Kết quả external được cache với source, retrievedAt và verification status.

## Authentication và dữ liệu nhạy cảm

- Authentication thuộc application, dùng Argon2id password hash và opaque session
  token được lưu hash trong `AuthSession`.
- Cookie session production dùng `__Host-`, `HttpOnly`, `Secure`, `SameSite=Lax`,
  `Path=/` và thời hạn giới hạn.
- Login rate limit lưu persistent trong PostgreSQL để không phụ thuộc một process.
- Session revoke và expiry được kiểm tra ở server; browser không tự quyết định
  quyền truy cập.
- Trusted request context đọc session, actor và các membership/store đang active
  bằng một câu SQL tham số hóa trong identity infrastructure. Không dùng nested
  relation read ở hot path này vì PostgreSQL driver adapter tách nó thành nhiều
  statement; token thô vẫn chỉ được hash trước khi bind. `lastUsedAt` được touch
  có throttle trong after-response hook và không làm chậm hoặc làm fail business
  response.
- Session/token không lưu trong localStorage.
- Authorization được thực thi server-side.
- Secret chỉ nằm trong environment/secret manager.
- Audit log tránh chứa dữ liệu nhạy cảm không cần thiết.
- Hồ sơ bệnh nhân là module hậu MVP, cần policy quyền truy cập riêng và rà soát
  quy định Việt Nam trước khi dùng thực tế.

## Deploy ban đầu

- Next.js trên Vercel hoặc runtime Node tương đương.
- PostgreSQL và auth/storage trên Supabase.
- Migration chạy có kiểm soát trước application rollout.
- Backup tự động và kiểm thử restore định kỳ trước production.

Offline-first chưa thuộc MVP vì xung đột tồn kho khi nhiều thiết bị đồng bộ là
một bài toán riêng. Có thể bắt đầu bằng degraded mode: giữ giỏ hàng nháp nhưng
không xác nhận xuất kho khi server không thể bảo đảm tồn.
