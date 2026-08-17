# ADR-005: Version conversion của StoreSKU

- Status: accepted
- Date: 2026-08-17

## Context

`StoreSku.quantityInBaseUnit` là conversion hiện tại dùng cho thao tác catalog,
nhưng BR-UNIT-004 cấm sửa ngược conversion đã được giao dịch lịch sử sử dụng.
Audit log cho biết ai sửa gì nhưng không phải domain record có khoảng hiệu lực để
phiếu nhập, sale và reconciliation tham chiếu ổn định.

Khóa conversion vĩnh viễn sau giao dịch đầu tiên đơn giản hơn, nhưng buộc nhà
thuốc tạo SKU mới cho mọi sửa sai về quy cách và chưa giải quyết việc xác định
conversion nào có hiệu lực tại thời điểm transaction.

## Decision

- Giữ `StoreSku.quantityInBaseUnit` và `currentConversionVersion` làm projection
  hiện tại cho read path nhanh.
- Mỗi SKU có các `StoreSkuConversionVersion` bất biến về giá trị, đánh số tăng
  dần và có `effectiveFrom`/`effectiveTo`.
- Tạo SKU đồng thời tạo version 1. Đổi conversion phải đóng version hiện tại, tạo
  version kế tiếp, cập nhật projection và ghi audit trong cùng transaction.
- Chỉ có một version mở (`effectiveTo IS NULL`) cho mỗi SKU; database bảo vệ bằng
  partial unique index và các check constraint dương/chính xác.
- Dòng giao dịch E3/E5 phải snapshot `quantityInBaseUnit` cùng
  `currentConversionVersion`; không đọc lại conversion master để tính lịch sử.
- Giá bán không nằm trong bảng conversion version. Transaction line vẫn snapshot
  giá; thay đổi master price tiếp tục được audit riêng.

## Consequences

- Sửa quy đổi không viết lại lịch sử và có thể truy được giá trị hiệu lực.
- Update conversion thêm hai write trong transaction (đóng version, tạo version),
  nhưng đây là mutation hiếm và không nằm trên catalog read hot path.
- Fixture/import tạo SKU trực tiếp phải tạo conversion version tương ứng; không
  được chỉ ghi `store_skus`.
- E3 phải mang version vào receipt line và snapshot; E5 làm tương tự cho sale
  line. Nếu projection và version hiện tại lệch, command phải fail và báo lỗi dữ
  liệu thay vì tự sửa lịch sử.
