# Chiến lược dữ liệu danh mục thuốc

## Nguyên tắc

Không cố tải toàn bộ thị trường thuốc rồi coi đó là dữ liệu vận hành. Hệ thống có
hai lớp độc lập:

1. **Global catalog:** dữ liệu tham chiếu dùng chung, có nguồn và mức xác minh.
2. **Store catalog:** các mặt hàng một nhà thuốc thực sự nhập, định giá và bán.

Một nhà thuốc phải có thể vận hành ngay cả khi global catalog thiếu dữ liệu.

## Nguồn dữ liệu

### Cơ sở dữ liệu về Dược của Bộ Y tế

Đây là hướng tích hợp production ưu tiên. Theo tài liệu kỹ thuật được công bố,
API v2 dùng REST/JSON, OAuth2/Bearer token và có production/sandbox. Quyền truy
cập cần được đăng ký với đơn vị vận hành; không giả định đây là public bulk API.

Tham khảo:

- [Thông báo ban hành đặc tả API của Bộ Y tế](https://moh.gov.vn/chuyen-doi-so-y-te/-/asset_publisher/bGrskQ5MmTm7/content/ban-hanh-tai-lieu-ky-thuat-ac-tai-api-he-thong-co-so-du-lieu-ve-duoc-phien-ban-1-0-)
- [Trang công bố đăng ký thuốc của Cục Quản lý Dược](https://dav.gov.vn/dang-ki-thuoc-cn6.html)

API được đặt sau `NationalDrugCatalogProvider`; credentials và payload thật
không xuất hiện trong repository.

### Quyết định/phụ lục của Cục Quản lý Dược

Các file công bố cấp mới, gia hạn, sửa đổi và thu hồi có thể dùng để bootstrap
hoặc đối chiếu. Vì định dạng và cấu trúc thay đổi theo văn bản, chúng phải đi qua
staging và review; không parse trực tiếp vào bảng production trong request path.

### Nhà cung cấp và phần mềm cũ

Đây là nguồn tốt nhất cho dữ liệu hàng hóa thực tế:

- Barcode và quy cách đang giao dịch.
- Giá nhập và đơn vị mua.
- Mapping nhà cung cấp.
- Tồn đầu kỳ, batch và expiry khi migrate.

Giá và tồn từ nguồn này chỉ thuộc store, không được đưa vào global catalog.

Khi nâng dữ liệu legacy lên schema mới, dùng adapter/staging thay vì ghi thẳng
vào bảng production. Phải giữ `sourceReference` và payload gốc để truy vết,
cho phép import lặp lại theo idempotency key, và không tự động biến dữ liệu cũ
thành `VERIFIED`. Trong giai đoạn chuyển đổi ưu tiên dual-read/one-write để
quy trình cũ vẫn chạy ổn định trong khi dữ liệu mới được chuẩn hóa dần.

### OCR và đóng góp cộng đồng

OCR từ bao bì/hóa đơn chỉ tạo suggestion. Đóng góp từ store tạo
`CatalogSubmission`; chỉ reviewer có quyền approve/merge thành dữ liệu
chung đã xác minh.

Không scrape hàng loạt website bên thứ ba khi chưa có API/license hoặc điều khoản
sử dụng rõ ràng.

## Luồng lookup khi quét

```text
scan barcode
  -> exact StoreBarcode in active store
      -> found: use local SKU
      -> not found: verified GlobalBarcode lookup
          -> one match: confirm local fields and create StoreProduct/StoreSKU
          -> multiple matches: require explicit selection
          -> no match: open quick-create form with barcode prefilled
              -> optional OCR/supplier suggestion
              -> save local product immediately
              -> optionally submit global catalog proposal
```

Barcode scanner chỉ trả chuỗi mã. Không có database match thì scanner không thể
tự biết tên thuốc; “scan điền form” phải là OCR/lookup riêng và cần xác nhận.

## Import pipeline

```text
source file/API
  -> import job
  -> raw/staging rows
  -> normalize
  -> validate
  -> resolve identities and detect duplicates
  -> preview/review queue
  -> transactional upsert
  -> import report and audit
```

### Trường staging tối thiểu

- `importId`, `rowNumber`.
- `source`, `sourceReference`.
- `rawPayload`.
- `normalizedPayload`.
- `validationErrors`.
- `candidateMatches` và match confidence.
- `resolution`: create, update, link, skip hoặc review.
- `processedAt` và actor.

### Thứ tự entity resolution

1. External official ID.
2. Registration number.
3. Registration number + package.
4. Manufacturer + normalized name + ingredients + strength + dosage form.
5. Barcode ở package level.

Không dùng fuzzy name match để tự động merge. Fuzzy match chỉ tạo candidate cho
reviewer.

## Provenance và độ tin cậy

Mỗi global field hoặc version cần truy được:

- Nguồn dữ liệu.
- Source reference/URL/document number.
- Thời điểm lấy dữ liệu.
- Người hoặc job tạo.
- Verification status.
- Reviewer và thời điểm review.
- Raw snapshot hoặc checksum phù hợp.

Độ ưu tiên mặc định:

```text
official verified
  > admin/pharmacist verified
  > supplier import
  > store submission
  > OCR suggestion
  > synthetic demo
```

Local override không bị nguồn có độ ưu tiên cao hơn tự động xóa; người dùng phải
được cho biết source version đã thay đổi và quyết định reconcile.

## Seed cho portfolio

Mục tiêu 300-1.000 sản phẩm đại diện, không cần hàng chục nghìn record.

- Dùng một tập dữ liệu công bố có nguồn rõ ràng cho thông tin tham chiếu.
- Tạo synthetic store data riêng: barcode demo, giá, conversion, batch, expiry.
- Barcode giả dùng namespace dễ nhận biết như `DEMO000001`; không ghép barcode
  thật với metadata tự chế.
- Bao phủ hộp, vỉ, viên, chai, lọ, ống, tuýp và gói.
- Có fixtures cho batch gần hết hạn, nhiều batch, hàng trả và concurrent sale.
- Seed phải deterministic và chạy lại được.

## File import store catalog đề xuất

```text
barcode
productName
registrationNumber
ingredient
strength
manufacturer
purchaseUnit
baseUnit
conversionRate
purchasePrice
sellingPrice
batchNumber
expiryDate
quantity
```

Importer cần tải file lỗi theo dòng và cho phép sửa/re-upload. Không commit một
phần phiếu nhập nếu các dòng bắt buộc chưa hợp lệ.

## Đồng bộ global catalog

- Pull theo lịch hoặc incremental cursor nếu provider hỗ trợ.
- Cache local để lookup nhanh và chịu lỗi external.
- Upsert idempotent theo official/source ID.
- Tạo version cho thay đổi cùng legal product.
- Xử lý thu hồi/gia hạn thành trạng thái và cảnh báo, không xóa lịch sử.
- Không tự động chặn hoặc xóa tồn chỉ vì source thay đổi; tạo task cho dược sĩ
  đánh giá và áp dụng chính sách pháp lý/vận hành phù hợp.
