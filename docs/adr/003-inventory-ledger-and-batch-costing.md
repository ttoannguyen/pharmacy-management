# ADR-003: Inventory ledger và giá vốn theo batch allocation

- Status: accepted
- Date: 2026-08-17

## Context

Một trường `stockQuantity` có thể cho kết quả nhanh nhưng không giải thích được
tồn phát sinh từ đâu, ai điều chỉnh hoặc lô nào đã bán. Tính giá vốn bằng giá nhập
gần nhất cho kết quả lợi nhuận sai khi tồn gồm nhiều lô.

## Decision

- StockMovement bất biến là source of truth cho tồn kho.
- Có thể duy trì balance projection trong cùng transaction để đọc nhanh.
- Mọi receipt, sale, return, cancellation, damage, loss, expiry và adjustment tạo
  movement có document, actor và reason.
- Sale phân bổ actual batch theo FEFO và lưu BatchAllocation.
- COGS lấy từ quantity và cost snapshot của từng allocation.
- Completed transactions được sửa bằng reversal/compensating records.

## Consequences

- Có thể truy vết và tái tạo tồn kho.
- Báo cáo lợi nhuận đúng với lô thực xuất.
- Checkout phức tạp hơn và cần concurrency test/locking.
- Cần công cụ reconciliation giữa ledger và balance projection.
