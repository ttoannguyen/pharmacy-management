# Đánh giá trạng thái sản phẩm ngoài chức năng scan

Ngày đánh giá: 2026-08-17.

## Kết luận

Ứng dụng hiện là một foundation tốt cho multi-tenant authentication và catalog,
nhưng chưa phải MVP vận hành nhà thuốc. Chỉ các luồng đăng nhập, chọn nhà thuốc,
phân quyền nền tảng, xem/tìm/tạo sản phẩm local và cấu hình SKU đầu tiên đã có
code chạy. Nhập kho, tồn theo lô, bán hàng FEFO, trả/hủy và báo cáo chưa có schema
và transaction boundary cần thiết, vì vậy không được biểu diễn bằng số liệu giả
hoặc màn hình khiến người dùng hiểu nhầm là đã hoạt động.

## Những điểm đã cải thiện trong đợt rà soát này

- Dashboard dùng aggregate tenant-scoped từ catalog thay cho doanh thu, tồn kho
  và hạn dùng giả.
- Menu của phân hệ chưa triển khai được đánh dấu rõ thay vì điều hướng tới 404.
- Danh mục render trang đầu trên server; client không phải chờ thêm một API
  waterfall sau khi trang xuất hiện.
- TanStack Query giữ dữ liệu cũ khi đổi tìm kiếm/trang, hủy request lỗi thời,
  debounce input, cache read model và prefetch trang kế tiếp.
- Tìm kiếm local khớp tên hiển thị, mã SKU, mã nhận diện, tên/số đăng ký được
  liên kết; mọi query vẫn bắt buộc có `storeId` từ trusted context.
- Session/membership trong cùng một server render được memoize theo request;
  việc ghi `lastUsedAt` được giới hạn tối đa một lần mỗi năm phút thay vì mỗi
  request.
- Form tạo sản phẩm diễn đạt đúng đơn vị tồn cơ sở, quy đổi, tiền VND, vị trí kệ
  và tồn tối thiểu; sau khi lưu quay lại danh mục.

## Khoảng trống ưu tiên

1. Xây goods receipt -> batch -> immutable stock movement -> balance trong một
   transaction, kèm rollback và tenant tests.
2. Sau khi ledger ổn định, xây POS -> FEFO allocation -> COGS từ đúng batch.
3. Chỉ sau khi có transaction snapshot mới làm dashboard doanh thu và báo cáo.
4. Bổ sung Playwright và đo p95 cho catalog search khi có tập dữ liệu đủ lớn;
   build/test hiện chỉ chứng minh correctness và bundle compilation, chưa thay
   thế load test trên database có độ trễ production.

## Nguyên tắc hiệu năng cần giữ

- Server-render read model cần cho first paint; TanStack Query quản lý cache và
  tương tác tiếp theo, không thay thế server authorization.
- Tránh gọi nội bộ HTTP từ Server Component; gọi application use case trực tiếp.
- Query độc lập phải chạy song song, phân trang có giới hạn và cancel request cũ.
- Không cache chéo tenant. Query key phía client là tiện ích UX; server luôn tự
  resolve active store và authorize lại.
