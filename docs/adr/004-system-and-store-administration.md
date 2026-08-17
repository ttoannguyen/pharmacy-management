# ADR-004: Tách quyền hệ thống khỏi quyền nhà thuốc

- Status: accepted
- Date: 2026-08-17

## Context

`SYSTEM_ADMIN` từng nằm trong `MembershipRole`, khiến quyền quản trị toàn nền
tảng bị mô hình hóa như một vai trò bên trong một nhà thuốc. Điều này trộn control
plane với dữ liệu tenant và dễ tạo bypass tenant không minh bạch.

## Decision

- `User.systemRole` giữ quyền toàn hệ thống; hiện có `USER` và `SYSTEM_ADMIN`.
- `Membership.role` chỉ giữ quyền trong một nhà thuốc; `OWNER` là admin cao nhất
  của nhà thuốc đó.
- `SYSTEM_ADMIN` quản lý tài khoản, nhà thuốc và danh mục chung qua boundary toàn
  hệ thống.
- `SYSTEM_ADMIN` không tự nhận quyền vận hành trong mọi nhà thuốc. Truy cập dữ
  liệu tenant vẫn cần membership rõ ràng hoặc một cơ chế support access có audit
  được thiết kế riêng sau này.
- Một tài khoản có thể đồng thời là `SYSTEM_ADMIN` và `OWNER` của một hoặc nhiều
  nhà thuốc, nhưng hai quyền được kiểm tra độc lập theo đúng scope.

## Consequences

- Có thể tạo tài khoản quản trị nền tảng không cần membership giả.
- Chủ nhà thuốc không thể truy cập control plane toàn hệ thống.
- Mọi guard phải chọn rõ system permission hoặc store permission; không dùng một
  role để thay thế cho cả hai.
- Việc cấp/thu hồi `SYSTEM_ADMIN` là thao tác nhạy cảm, phải audit và không được
  thực hiện từ client chỉ bằng cách gửi role.
