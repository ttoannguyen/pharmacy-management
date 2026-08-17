# Mô hình domain cốt lõi

## Catalog nhiều tầng

```text
DrugConcept
  -> RegisteredProduct
       -> RegisteredProductVersion
       -> ProductPackage
            -> GlobalBarcode

RegisteredProduct (optional reference)
  <- StoreProduct
       -> StoreSKU -> ProductPackage (optional reference)
            -> StoreBarcode
            -> InventoryBatch
                 -> StockMovement
```

## DrugConcept

Khái niệm thuốc dùng để tìm kiếm và phân nhóm theo dược học, ví dụ
`Paracetamol 500 mg - viên nén - đường uống`.

Thuộc tính chính:

- Hoạt chất và hàm lượng.
- Dạng bào chế.
- Đường dùng.
- Tên chuẩn hóa phục vụ tìm kiếm.

Không chứa nhà sản xuất, số đăng ký, barcode, giá hay tồn kho.

## RegisteredProduct

Một sản phẩm thuốc pháp lý/thương mại cụ thể:

- Tên thương mại.
- Số đăng ký hoặc ID chính thức.
- Nhà sản xuất và chủ sở hữu đăng ký.
- Nước sản xuất.
- Trạng thái lưu hành.
- Liên kết tới DrugConcept.

Cùng tên nhưng khác nhà sản xuất hoặc số đăng ký là các RegisteredProduct riêng.

## RegisteredProductVersion

Lưu lịch sử thay đổi của cùng một RegisteredProduct:

- Snapshot dữ liệu có version.
- Hiệu lực từ/đến thời điểm nào.
- Nguồn quyết định hoặc dữ liệu.
- Lý do thay đổi.

Không dùng version để biểu diễn sản phẩm của nhà sản xuất khác.

## ProductPackage và GlobalBarcode

Một RegisteredProduct có thể có nhiều quy cách:

```text
Hộp 10 vỉ x 10 viên -> barcode A
Hộp 20 vỉ x 10 viên -> barcode B
Chai 500 viên       -> barcode C
```

Barcode gắn với package/SKU cụ thể. Một package có thể có nhiều barcode do thay
bao bì theo thời gian. Mapping phải có trạng thái xác minh và khoảng hiệu lực.

## StoreProduct và local override

StoreProduct là cách một nhà thuốc quản lý/bán một sản phẩm. Nó có thể liên kết
tới global package/product hoặc tồn tại độc lập khi chưa nhận diện được.

Thuộc tính riêng:

- `storeId`.
- `registeredProductId`, nullable; StoreSKU có `productPackageId`, nullable.
- Tên hiển thị/tên viết tắt.
- Vị trí kệ và tồn tối thiểu.
- Trạng thái kinh doanh.
- `basedOnGlobalVersion`.
- Các trường override rõ ràng.

Giá trị hiệu lực được resolve theo thứ tự:

```text
local override -> global verified value -> supplier suggestion -> unverified/OCR
```

Không tồn tại bảng bắt buộc tên `GlobalProduct`; “global catalog” là tên của lớp
dữ liệu dùng chung. Không copy toàn bộ shared record rồi mất liên kết và không
cho local edit sửa trực tiếp dữ liệu dùng chung.

## StoreSKU, đơn vị và quy đổi

StoreSKU đại diện cho một cấp bán/mua thực tế, ví dụ hộp, vỉ hoặc viên.

- Mỗi sản phẩm có một base unit dùng cho ledger.
- Conversion factor phải dương và chính xác.
- Ví dụ: 1 hộp = 10 vỉ, 1 vỉ = 10 viên, nên 1 hộp = 100 base units.
- Barcode nhà sản xuất thường gắn cấp hộp; barcode nội bộ có thể dùng cho cấp vỉ.
- Không tự suy diễn quy đổi chỉ từ chuỗi mô tả nếu chưa được xác nhận.

## InventoryBatch

Đại diện tồn kho có cùng:

- Store/location.
- StoreSKU hoặc base product.
- Số lô.
- Hạn dùng.
- Giá vốn đơn vị tại thời điểm nhập.
- Nguồn phiếu nhập.

Batch không tự đóng vai trò ledger. Số dư batch được hình thành từ StockMovement
hoặc một projection có thể đối soát với movement.

## StockMovement

Các loại movement tối thiểu:

- `RECEIPT`.
- `SALE`.
- `SALE_RETURN`.
- `PURCHASE_RETURN`.
- `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`.
- `DAMAGE`, `LOSS`, `EXPIRY`.
- `TRANSFER_IN`, `TRANSFER_OUT` ở giai đoạn đa kho.
- `REVERSAL` liên kết movement gốc.

Movement là bất biến sau khi hoàn tất, gồm actor, reason, document reference,
batch, quantity in base unit và timestamp.

## Sale và BatchAllocation

SaleLine lưu snapshot tên hàng, đơn vị, số lượng, đơn giá, giảm giá và thuế nếu
có. BatchAllocation nối một SaleLine với các batch thực xuất:

```text
SaleLine: 15 viên
  -> Batch A: 10 viên x cost 700
  -> Batch B:  5 viên x cost 750
```

COGS của dòng là `10*700 + 5*750`, không lấy giá nhập gần nhất.

## CatalogSubmission

Khi scan không có dữ liệu chung, nhà thuốc có thể tạo local product ngay và gửi
`CatalogSubmission` đề xuất bổ sung:

- Store/user gửi.
- Barcode và proposed data.
- Ảnh bao bì/chứng từ.
- Nguồn và confidence.
- Trạng thái `PENDING`, `APPROVED`, `REJECTED`, `MERGED`.
- Reviewer, quyết định và thời gian.

Sau khi duyệt, local product được relink tới global record mà không thay đổi giá,
quy đổi, batch hoặc tồn kho của nhà thuốc.

## Khóa và nhận dạng

Thứ tự đối chiếu đề xuất:

1. ID chính thức từ hệ thống dược.
2. Số đăng ký.
3. Số đăng ký cộng quy cách đóng gói.
4. Nhà sản xuất, tên, hoạt chất, hàm lượng và dạng bào chế.
5. Barcode ở cấp package.

Tên không bao giờ là khóa duy nhất.
