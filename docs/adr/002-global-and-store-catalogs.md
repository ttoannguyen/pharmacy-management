# ADR-002: Tách global catalog và store catalog

- Status: accepted
- Date: 2026-08-17

## Context

Hệ thống cần nhận diện thuốc dùng chung nhưng mỗi nhà thuốc có tên hiển thị, giá,
quy đổi, barcode nội bộ và danh mục kinh doanh riêng. Dữ liệu chung có thể thiếu,
sai hoặc thay đổi theo nguồn chính thức. Cho store sửa trực tiếp dữ liệu chung sẽ
gây ảnh hưởng chéo; copy toàn bộ sẽ mất khả năng đồng bộ.

## Decision

- Dùng global catalog làm reference data có provenance và version.
- StoreProduct giữ nullable `registeredProductId`; StoreSKU giữ nullable
  `productPackageId`. Không tạo một bảng `GlobalProduct` mơ hồ chỉ để làm alias.
- Store customization được lưu dưới dạng explicit local override cùng
  `basedOnGlobalVersion`.
- Correction dữ liệu chung đi qua submission/review.
- Inventory, batch, price và transaction chỉ tham chiếu store-owned entities.
- DrugConcept gom theo dược học; mỗi manufacturer/registration là một
  RegisteredProduct riêng; package/barcode là tầng thấp hơn.

## Consequences

- Store có thể vận hành khi global catalog chưa đầy đủ.
- Global update không phá giá, tồn hoặc quy đổi local.
- Cần logic resolve effective value và UI reconcile version.
- Cần moderation workflow và duplicate resolution cho dữ liệu đóng góp.
- Search/report có thể gom theo concept mà không gộp nhầm legal products.
