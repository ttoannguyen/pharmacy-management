# MVP roadmap

Mục tiêu là ship một vertical slice có thể demo và kiểm chứng nghiệp vụ, không mở
rộng đồng thời sang khám bệnh, đa chi nhánh và offline-first.

## Milestone 0 — Foundation

- Scaffold Next.js, TypeScript, Prisma và PostgreSQL.
- Environment validation, lint, format, unit test và CI.
- Auth, Store, Membership và role skeleton.
- Database migration, deterministic seed và backup notes.
- Error handling, structured logs và audit infrastructure.

Tiêu chí hoàn thành: deploy được một môi trường demo, migration chạy từ database
trống và tenant isolation có test.

## Milestone 1 — Catalog

- DrugConcept, RegisteredProduct, ProductPackage và barcode chung.
- StoreProduct, StoreSKU, local barcode và unit conversion.
- Search theo tên, hoạt chất, số đăng ký và barcode.
- Luồng scan local -> global -> quick-create.
- Import Excel qua staging, preview và duplicate review.

Tiêu chí hoàn thành: một store có thể tạo/link/override sản phẩm mà không sửa dữ
liệu store khác hoặc global record.

## Milestone 2 — Goods receipt và inventory

- Supplier và goods receipt draft/completed/cancelled.
- Nhập từng batch, expiry, purchase price và chứng từ.
- Stock movement ledger và balance projection.
- Cảnh báo sắp hết, hết hàng và gần hết hạn.
- Inventory adjustment có reason/audit.

Tiêu chí hoàn thành: hoàn tất/hủy phiếu nhập tạo movement đúng, rollback an toàn
và số dư tái tạo được từ ledger.

## Milestone 3 — POS và FEFO

- POS responsive và hỗ trợ USB/Bluetooth scanner như keyboard input.
- Cart, discount, cash/transfer và receipt 58/80 mm.
- FEFO batch allocation trong transaction.
- COGS snapshot từ batch allocation.
- Return/cancellation bằng reversal.

Tiêu chí hoàn thành: hai checkout đồng thời không thể bán vượt lô cuối; COGS đúng
khi một sale line lấy từ nhiều batch.

## Milestone 4 — Reporting và hardening

- Revenue, net sales, COGS và gross profit theo ngày/nhân viên/nhóm hàng.
- Fast/slow-moving, low stock và expiry reports.
- Role matrix và audit viewer.
- Playwright cho goods receipt -> sale -> return.
- Backup/restore rehearsal, performance và security review.

Tiêu chí hoàn thành: có demo public với seed synthetic, tài khoản demo theo role,
test CI và README mô tả quyết định kỹ thuật.

## Sau MVP

- Patient, visit và prescription, tách khỏi sale nhưng cho phép liên kết.
- Customer/supplier debt và operating expenses.
- E-invoice và national prescription integration.
- Organization, branch, warehouse transfer.
- OCR production workflow.
- Appointment/customer care.
- Offline operation với conflict resolution rõ ràng.

## Những việc cố ý không làm sớm

- Microservices.
- Event sourcing toàn hệ thống; chỉ inventory ledger cần đặc tính bất biến.
- AI tự chẩn đoán hoặc tự kê đơn.
- Scrape catalog không có license.
- Offline checkout khi server không thể đảm bảo tồn.
- Dashboard nhiều biểu đồ trước khi số liệu COGS được kiểm chứng.

## Điểm nhấn CV

Demo và README nên làm rõ:

- Multi-tenant authorization.
- Global-reference/local-override catalog.
- Import staging, provenance và entity resolution.
- Exact unit conversion.
- Transactional FEFO allocation và concurrency control.
- Batch-derived COGS.
- Reversal và immutable audit trail.
- Automated tests cho stock, money và tenant isolation.
