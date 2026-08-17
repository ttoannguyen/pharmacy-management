# ADR-001: Khởi đầu bằng modular monolith

- Status: accepted
- Date: 2026-08-17

## Context

Sản phẩm có nhiều domain nhưng MVP được xây dựng bởi nhóm nhỏ và cần ship nhanh.
Next.js có thể phục vụ UI và server application boundary trong cùng deployment.
Tách frontend/backend hoặc microservices ngay sẽ tăng boilerplate, authentication,
deployment và observability trước khi có nhu cầu vận hành thực tế.

## Decision

Xây một modular monolith bằng Next.js và TypeScript, dùng PostgreSQL/Prisma. Giữ
module boundary theo catalog, procurement, inventory, sales, reporting, identity
và audit. External integrations luôn nằm sau adapter.

## Consequences

- Một repository, một deployment chính và transaction database đơn giản.
- Ship vertical slice nhanh hơn.
- Cần kỷ luật dependency giữa module để tránh thành monolith rối.
- Chỉ tách service khi có áp lực rõ ràng về scale, security boundary, ownership
  hoặc workload nền độc lập; thay đổi đó phải có ADR mới.
