# Pharmacy Management

Ứng dụng quản lý nhà thuốc nhỏ, tập trung vào chuỗi nghiệp vụ cốt lõi:

```text
nhập kho theo lô -> tồn kho -> bán hàng -> giá vốn -> lợi nhuận
```

Dự án được xây dựng dưới dạng web app responsive/PWA, ưu tiên thao tác nhanh trên
máy tính và điện thoại. Kiến trúc khởi đầu là modular monolith với Next.js,
TypeScript và PostgreSQL.

## Tài liệu bắt đầu

- [Bối cảnh dự án](PROJECT_CONTEXT.md)
- [Quy tắc dành cho agent và contributor](AGENTS.md)
- [Kiến trúc hệ thống](docs/architecture.md)
- [ADR: quyền hệ thống và quyền nhà thuốc](docs/adr/004-system-and-store-administration.md)
- [ADR: version conversion StoreSKU](docs/adr/005-store-sku-conversion-history.md)
- [Mô hình domain](docs/domain/domain-model.md)
- [Quy tắc nghiệp vụ](docs/domain/business-rules.md)
- [Chiến lược dữ liệu thuốc](docs/data/medicine-catalog-strategy.md)
- [Phạm vi và roadmap MVP](docs/product/mvp-roadmap.md)
- [Implementation plan](docs/product/implementation-plan.md)
- [MVP execution plan](docs/product/mvp-execution-plan.md)
- [Performance implementation plan](docs/product/performance-change-direction.md)
- [Cache consistency và progressive warmup](docs/product/cache-consistency-strategy.md)
- [Đánh giá trạng thái sản phẩm hiện tại](docs/product/current-state-review.md)
- [Hướng dẫn deployment](docs/deployment.md)
- [Prompt tiếp tục MVP](docs/prompts/continue-mvp.md)
- [Nhật ký bàn giao](HANDOFF.md)

## Chạy local

Yêu cầu Node.js 22+ và PostgreSQL.

`DATABASE_URL` dùng cho runtime; `DIRECT_URL` dùng cho Prisma CLI/migration. Với
Supabase, nên dùng transaction pooler cho runtime và session/direct connection
cho migration.

Đăng nhập do ứng dụng tự quản lý qua Prisma: cần đặt `AUTH_PEPPER` là chuỗi bí
mật server-only (ít nhất 32 ký tự). Tài khoản demo sau khi chạy seed là
`owner@demo.invalid` với mật khẩu `DemoPassword123!`; chỉ dùng cho môi trường
local.

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Các lệnh kiểm tra:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Trạng thái

Foundation identity/tenant và catalog local đã có API/UI responsive. Dashboard và
catalog dùng server-first rendering kết hợp TanStack Query cho client cache.
Procurement, inventory ledger, FEFO sales và reporting chưa triển khai; thứ tự và
exit gate được định nghĩa trong MVP execution plan.

Mọi thay đổi tiếp theo phải giữ đúng các quyết định và invariant đã ghi trong tài
liệu, hoặc bổ sung ADR nếu cần thay đổi chúng.
