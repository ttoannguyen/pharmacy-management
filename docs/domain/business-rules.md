# Quy tắc nghiệp vụ

Các rule trong tài liệu này là invariant. UI có thể diễn đạt khác nhau nhưng
backend và database không được vi phạm chúng.

## BR-CAT — Danh mục

- **BR-CAT-001:** Cùng tên không đồng nghĩa cùng sản phẩm.
- **BR-CAT-002:** Khác nhà sản xuất hoặc số đăng ký phải là RegisteredProduct
  riêng, không phải version.
- **BR-CAT-003:** Barcode gắn với package/SKU, không gắn trực tiếp DrugConcept.
- **BR-CAT-004:** StoreProduct được phép không có global reference.
- **BR-CAT-005:** Store edit tạo local override; không sửa global record.
- **BR-CAT-006:** Global correction phải qua submission và review.
- **BR-CAT-007:** Dữ liệu OCR/unverified không ghi đè dữ liệu verified.
- **BR-CAT-008:** Khi global record thay đổi, local override vẫn được giữ và hệ
  thống cảnh báo nếu `basedOnGlobalVersion` đã cũ.
- **BR-CAT-009:** Merge/relink catalog không được thay đổi lịch sử giao dịch.
- **BR-CAT-010:** Master data đã được giao dịch tham chiếu chỉ được archive.

## BR-SCAN — Tra cứu barcode

- **BR-SCAN-001:** Tìm StoreBarcode trong active store trước.
- **BR-SCAN-002:** Nếu không có local match, tìm GlobalBarcode đã xác minh.
- **BR-SCAN-003:** Một global match cần người dùng xác nhận local unit, conversion
  và price trước khi tạo StoreProduct/StoreSKU.
- **BR-SCAN-004:** Nhiều match không được tự chọn; phải yêu cầu người dùng chọn.
- **BR-SCAN-005:** Không có match thì mở form tạo nhanh; barcode được điền sẵn.
- **BR-SCAN-006:** OCR là lựa chọn bổ trợ để đề xuất trường, luôn cần xác nhận.
- **BR-SCAN-007:** Lỗi nguồn lookup bên ngoài không được chặn nhập tay.

## BR-UNIT — Đơn vị và quy đổi

- **BR-UNIT-001:** Mỗi StoreProduct có đúng một base unit cho inventory ledger.
- **BR-UNIT-002:** Conversion factor phải lớn hơn 0 và không mâu thuẫn giữa các
  đường quy đổi.
- **BR-UNIT-003:** Quantity movement được lưu bằng base unit hoặc có snapshot
  conversion đủ để tính lại chính xác.
- **BR-UNIT-004:** Không thay đổi conversion đã dùng trong giao dịch lịch sử;
  tạo version mới có hiệu lực về sau.
- **BR-UNIT-005:** Số lượng không dùng binary floating point.

## BR-INV — Nhập và tồn kho

- **BR-INV-001:** Phiếu nhập draft không làm tăng tồn.
- **BR-INV-002:** Chỉ phiếu nhập completed mới tạo batch/movement.
- **BR-INV-003:** Mỗi dòng nhập phải có sản phẩm, số lượng, đơn vị, conversion,
  giá nhập, batch number và expiry khi loại hàng yêu cầu quản lý lô.
- **BR-INV-004:** Mọi thay đổi tồn phải có StockMovement.
- **BR-INV-005:** Không sửa trực tiếp số tồn để xử lý chênh lệch; tạo adjustment.
- **BR-INV-006:** Adjustment cần actor, lý do và approval khi vượt ngưỡng cấu hình.
- **BR-INV-007:** Không hard-delete completed receipt, batch hoặc movement.
- **BR-INV-008:** Không cho tồn khả dụng âm.
- **BR-INV-009:** Batch hết hạn không được tự động phân bổ bán.
- **BR-INV-010:** Hàng hỏng, mất, hết hạn và trả nhà cung cấp dùng movement riêng.

## BR-SALE — Bán hàng

- **BR-SALE-001:** Sale draft không làm giảm tồn.
- **BR-SALE-002:** Checkout phải phân bổ đủ tồn trong một transaction trước khi
  sale chuyển completed.
- **BR-SALE-003:** Phân bổ mặc định theo expiry sớm nhất, sau đó receivedAt và ID
  làm tie-breaker để kết quả deterministic.
- **BR-SALE-004:** Không tự phân bổ batch hết hạn hoặc bị quarantine.
- **BR-SALE-005:** SaleLine lưu snapshot tên, SKU, unit, conversion, unit price và
  discount.
- **BR-SALE-006:** BatchAllocation lưu batch, quantity và cost snapshot.
- **BR-SALE-007:** Hủy completed sale tạo reversal; không xóa sale gốc.
- **BR-SALE-008:** Trả hàng liên kết sale line gốc khi có thể và không hoàn nhập
  hàng không còn đủ điều kiện bán.
- **BR-SALE-009:** Sửa giá ngoài quyền hạn cần approval và audit reason.

## BR-FIN — Tài chính

- **BR-FIN-001:** Tiền dùng integer minor unit hoặc exact decimal thống nhất.
- **BR-FIN-002:** Net revenue được tính từ snapshot transaction, không từ master
  price hiện tại.
- **BR-FIN-003:** COGS lấy từ actual batch allocations.
- **BR-FIN-004:** Gross profit phải có công thức được định nghĩa rõ trong báo cáo;
  baseline MVP là net sales trừ COGS và các ảnh hưởng trả hàng liên quan.
- **BR-FIN-005:** Refund/reversal không sửa payment gốc mà tạo record liên kết.
- **BR-FIN-006:** Báo cáo phải dùng cùng timezone cửa hàng cho ranh giới ngày,
  trong khi timestamp lưu UTC.

## BR-SEC — Tenant, quyền và audit

- **BR-SEC-001:** User chỉ truy cập store thông qua membership còn hiệu lực.
- **BR-SEC-002:** Store scope lấy từ authenticated context, không tin `storeId`
  client gửi.
- **BR-SEC-003:** Mọi query operational data phải tenant-scoped.
- **BR-SEC-004:** Global catalog không cho store user sửa trực tiếp.
- **BR-SEC-005:** Hủy đơn, sửa giá, adjustment, sửa conversion, thay role và merge
  catalog phải có audit.
- **BR-SEC-006:** Audit record không được chứa token, password hoặc dữ liệu nhạy
  cảm không cần thiết.
- **BR-SEC-007:** `OWNER` là admin của một nhà thuốc; `SYSTEM_ADMIN` là quyền toàn
  hệ thống trên User và không được lưu trong Membership.
- **BR-SEC-008:** System admin không tự bypass store scope. Mọi support access vào
  dữ liệu tenant phải rõ store, có lý do, thời hạn và audit.
- **BR-SEC-009:** Cấp hoặc thu hồi system role phải chạy server-side, audit trước/
  sau và không tin role do client gửi.
- **BR-SEC-010:** Một User có thể vừa là `SYSTEM_ADMIN` vừa là `OWNER`, nhưng mọi
  use case phải kiểm tra đúng system permission hoặc store permission tương ứng.

## BR-IMP — Import và đồng bộ

- **BR-IMP-001:** Import đi qua staging, validation và preview trước commit.
- **BR-IMP-002:** Mỗi row có source, source reference và raw payload đủ truy vết.
- **BR-IMP-003:** Import phải idempotent theo source key/import key.
- **BR-IMP-004:** Record nghi trùng đi vào review queue, không tự merge theo tên.
- **BR-IMP-005:** Import catalog không được ghi đè local price, conversion, batch
  hoặc stock.
- **BR-IMP-006:** Dữ liệu synthetic/demo phải được gắn nhãn rõ và không được đẩy
  vào production như verified data.
