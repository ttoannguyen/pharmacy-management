# Project Context

Đây là tài liệu bắt buộc phải đọc trước khi thay đổi code, database, API hoặc
kiến trúc của dự án.

## Sản phẩm là gì

Pharmacy Management là ứng dụng web tất cả trong một cho nhà thuốc nhỏ tại Việt
Nam. Sản phẩm phải chạy tốt trên desktop và điện thoại, ưu tiên thao tác nhanh,
quản lý tồn kho theo lô và hạn dùng, đồng thời tính đúng doanh thu, giá vốn và
lợi nhuận.

Giá trị cốt lõi của phiên bản đầu:

```text
Danh mục thuốc
  -> nhập kho theo lô
  -> tồn kho truy vết được
  -> bán hàng theo FEFO
  -> giá vốn đúng lô
  -> báo cáo lợi nhuận gộp
```

## Người dùng

- Chủ nhà thuốc (`OWNER`): admin trong các nhà thuốc mà họ có membership, toàn
  quyền cấu hình và xem báo cáo của đúng tenant đó.
- Dược sĩ/người bán: bán hàng, trả hàng và tư vấn.
- Nhân viên kho: nhập hàng, kiểm kho và xử lý lô.
- Kế toán: doanh thu, chi phí, công nợ và đối soát.
- Người khám: hồ sơ khám và kê đơn ở giai đoạn sau.
- Quản trị hệ thống (`User.systemRole = SYSTEM_ADMIN`): control plane toàn nền
  tảng, tài khoản, nhà thuốc, danh mục chung và audit hệ thống; không phải một
  `MembershipRole` và không tự bypass tenant khi vận hành nhà thuốc.

## Phạm vi MVP

1. Tài khoản, tenant/nhà thuốc, vai trò và phân quyền.
2. Danh mục thuốc chung và danh mục riêng của nhà thuốc.
3. Barcode, đơn vị tính và quy đổi hộp-vỉ-viên.
4. Nhập kho theo sản phẩm, lô, hạn dùng và giá nhập.
5. Bán hàng responsive, thanh toán và in hóa đơn.
6. Xuất lô theo FEFO và tính giá vốn theo đúng lô thực xuất.
7. Trả/hủy bằng giao dịch đảo ngược.
8. Cảnh báo tồn tối thiểu và hạn dùng.
9. Báo cáo doanh thu, giá vốn và lợi nhuận gộp.
10. Audit log và sao lưu dữ liệu.

Ngoài MVP: hồ sơ khám, đơn thuốc, công nợ đầy đủ, chi phí nâng cao, hóa đơn điện
tử, đa chi nhánh, OCR hoàn chỉnh và offline-first.

## Stack đã chốt

- Next.js App Router và TypeScript.
- PostgreSQL; Supabase là lựa chọn hosting ban đầu.
- Prisma ORM và database migrations được version control.
- Tailwind CSS và shadcn/ui.
- Zod và React Hook Form.
- Prisma/PostgreSQL application-owned auth với Argon2id và opaque session cookie.
- ZXing cho barcode camera; vẫn hỗ trợ máy quét và nhập tay.
- Vitest cho unit/integration test và Playwright cho luồng quan trọng.
- Vercel và Supabase cho demo/deployment đầu tiên.

## Quyết định kiến trúc bắt buộc

- Bắt đầu bằng modular monolith, không dùng microservices cho MVP.
- Dữ liệu phải multi-tenant; mọi dữ liệu vận hành thuộc một nhà thuốc.
- Danh mục chung là dữ liệu tham chiếu, không chứa giá hay tồn kho của nhà thuốc.
- Tồn kho hình thành từ stock movement; không sửa trực tiếp một trường quantity.
- Lô và giao dịch kho tham chiếu StoreProduct/StoreSKU, không tham chiếu thẳng
  RegisteredProduct hoặc ProductPackage dùng chung.
- Các nhà sản xuất khác nhau là RegisteredProduct khác nhau, không phải version.
- Version chỉ biểu diễn lịch sử của cùng một thực thể pháp lý.
- Giao dịch đã hoàn tất không bị xóa; sửa sai bằng reversal/adjustment có lý do.
- Thao tác nhạy cảm phải có actor, thời gian, lý do và audit trail.
- OCR hoặc dữ liệu cộng đồng chỉ là đề xuất cho đến khi được xác minh.

## Yêu cầu chất lượng

- Ưu tiên tính đúng đắn của tồn kho và tài chính hơn số lượng màn hình.
- Mọi thao tác nhập/xuất nhiều bản ghi phải chạy trong database transaction.
- Các invariant quan trọng phải có automated test.
- Tiền tệ không dùng floating point.
- Số lượng quy đổi dùng kiểu số chính xác và một đơn vị cơ sở xác định.
- API và schema thay đổi phải cập nhật tài liệu trong cùng thay đổi.

## Tài liệu chi tiết

- `docs/architecture.md`
- `docs/domain/domain-model.md`
- `docs/domain/business-rules.md`
- `docs/data/medicine-catalog-strategy.md`
- `docs/product/mvp-roadmap.md`
- `docs/adr/001-modular-monolith.md`
- `docs/adr/002-global-and-store-catalogs.md`
