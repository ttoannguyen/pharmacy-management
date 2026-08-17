# Copyable implementation prompts

Các prompt dưới đây dành cho coding agent làm việc trực tiếp trong repository.
Prompt master phù hợp để tiếp tục qua nhiều phiên; prompt theo phase phù hợp khi
muốn kiểm soát phạm vi chặt hơn.

## Master prompt — tiếp tục task kế tiếp

Copy toàn bộ block sau:

```text
Bạn đang làm việc trong repository pharmacy-management.

Hãy tiếp tục triển khai MVP dựa trên trạng thái thật của repository, không giả
định tài liệu luôn khớp code. Trước khi sửa gì, đọc đầy đủ:

- AGENTS.md
- PROJECT_CONTEXT.md
- HANDOFF.md
- docs/architecture.md
- docs/domain/domain-model.md
- docs/domain/business-rules.md
- docs/product/implementation-plan.md
- docs/product/mvp-execution-plan.md
- docs/product/performance-change-direction.md
- docs/product/cache-consistency-strategy.md
- các ADR và tài liệu data/API liên quan trực tiếp đến task được chọn

Quy trình bắt buộc:

1. Inspect code, schema, migrations và trạng thái test hiện tại.
2. Chọn work package chưa hoàn thành sớm nhất trên critical path trong
   docs/product/mvp-execution-plan.md, rồi đối chiếu checkbox tương ứng tại
   docs/product/implementation-plan.md, trừ khi tôi chỉ định task khác.
3. Nêu ngắn gọn task sẽ làm và các invariant phải giữ, rồi triển khai thực tế.
4. Không dừng ở plan hoặc scaffold nếu vẫn còn bước implementation/test an toàn
   nằm trong phạm vi task.
5. Mọi dữ liệu operational phải tenant-scoped. storeId phải đến từ trusted
   authenticated context, không tin request input.
6. Store edit không được mutate shared catalog. Inventory không được sửa quantity
   trực tiếp; transaction completed không hard-delete.
7. Schema change phải có migration mới. Không sửa migration đã apply trên shared
   database. Giữ các raw SQL check constraint và composite tenant FK hiện có.
8. Không in, commit hoặc làm lộ DATABASE_URL, DIRECT_URL, token hay dữ liệu thật.
9. Thêm automated tests tương xứng, đặc biệt với tenant, auth, stock, money,
   concurrency và audit.
10. Chạy npm run lint, npm run typecheck, npm test và npm run build. Nếu có
    migration, validate/generate Prisma và kiểm tra migration status; không reset
    hoặc xóa database.
11. Cập nhật docs/product/implementation-plan.md, tài liệu contract liên quan và
    append một entry vào HANDOFF.md.

Definition of Done: behavior chạy được end-to-end trong phạm vi work package,
test chứng minh acceptance criteria, verification sạch, tài liệu phản ánh đúng
code, và final response nêu file thay đổi, kiểm tra đã chạy, gap còn lại và task
kế tiếp. Không tự đánh dấu hoàn thành nếu chỉ tạo interface/mock mà chưa có đường
đi thực tế.
```

## Prompt Phase 1 — auth và tenant context

```text
Triển khai Phase 1 trong docs/product/implementation-plan.md: application-owned
authentication, active store context và authorization policy.

Đọc và tuân thủ AGENTS.md cùng toàn bộ tài liệu bắt buộc. Dùng Argon2id cho
password, opaque random session token lưu hash trong AuthSession, và HttpOnly/
Secure/SameSite cookie; không lưu token ở localStorage. Đồng bộ local User bằng
email/password trong Prisma. Resolve actorId/storeId/role từ session + Membership còn hiệu lực;
không tin storeId request gửi. Thêm protected application area, error contracts,
tenant isolation tests giữa hai store và role-policy tests.

Không xây catalog mutation trước khi trusted request context hoạt động. Không làm
lộ env. Nếu schema đổi, tạo migration mới và không sửa initial migration đã apply.
Chạy lint, typecheck, test, build; cập nhật implementation plan và append HANDOFF.
```

## Prompt Phase 2 — catalog và barcode lookup

```text
Triển khai Phase 2 trong docs/product/implementation-plan.md sau khi xác nhận Phase
1 đã đạt acceptance criteria.

Xây vertical slice tenant-scoped cho barcode lookup theo thứ tự: exact local
StoreBarcode -> verified GlobalBarcode -> NOT_FOUND. Kết quả phải là discriminated
union LOCAL_MATCH, GLOBAL_MATCHES hoặc NOT_FOUND. Local luôn ưu tiên; nhiều global
match không tự chọn. Thêm create/link/override StoreProduct/StoreSku với validation
unit conversion, integer minor price, basedOnGlobalVersion và audit. Làm UI
responsive hỗ trợ scanner như keyboard, manual fallback và quick-create.

Test tối thiểu: local priority, unverified global bị loại, multiple global matches,
not found, store A/B isolation, invalid conversion, audit khi sửa giá/link. Không
để lỗi external lookup chặn nhập tay. Chạy toàn bộ verification, cập nhật plan,
contract docs và HANDOFF.
```

## Prompt E1 — catalog operational readiness ngoài scan

```text
Triển khai E1.1 trong docs/product/mvp-execution-plan.md, không làm camera scan
hoặc OCR.

Trước khi sửa code, đọc toàn bộ tài liệu bắt buộc và kiểm tra trạng thái thật của
catalog API/UI hiện tại. Xây product detail tenant-scoped, use case/API thêm một
StoreSku vào StoreProduct hiện có, và UI responsive quản lý danh sách SKU. Server
phải tự resolve active store; không tin storeId từ payload. Chuẩn hóa SKU/barcode,
trả conflict rõ cho duplicate, và ghi audit cho mutation nhạy cảm.

Dùng Server Component cho first data và TanStack Query cho detail cache/mutation;
không cache chéo store và không dùng client cache làm authorization. Test tối
thiểu store A/B isolation, role denial, duplicate SKU/barcode, invalid conversion,
atomic write và audit. Không làm inventory quantity giả. Chạy lint, typecheck,
tests, build; cập nhật implementation/execution plan và append HANDOFF.
```

## Prompt Phase 4 — nhập kho và inventory ledger

```text
Triển khai Phase 4 trong docs/product/implementation-plan.md. Trước tiên viết ADR
quyết định UUID v4/v7 cho append-heavy tables, sau đó xây Supplier, GoodsReceipt,
InventoryBatch, StockMovement và InventoryBalance.

Draft receipt không tác động tồn. Complete receipt phải tạo batch, immutable
movement và balance trong cùng database transaction. Cancellation dùng reversal,
không xóa/sửa movement cũ. Mọi entity operational tenant-scoped và có composite
tenant constraints phù hợp. Quantity/conversion dùng exact decimal; tiền dùng
integer minor units. Có reconciliation service và tests cho rollback, tenant
isolation, duplicate completion, reversal, expired batch và balance = ledger.

Không reset database hoặc chỉnh migration đã apply. Tạo migration mới, chạy toàn
bộ verification, cập nhật plan/domain docs và append HANDOFF.
```

## Prompt Phase 5 — POS, FEFO và COGS

```text
Triển khai Phase 5 trong docs/product/implementation-plan.md trên inventory ledger
đã hoàn chỉnh.

Xây Sale/SaleLine/Payment/BatchAllocation và POS responsive. Checkout phải atomic,
tenant-scoped, phân bổ FEFO theo expiry -> receivedAt -> ID, bỏ expired/quarantined
batch và ngăn concurrent oversell bằng database locking/conditional update. Lưu
snapshot price, unit, conversion và batch cost. COGS tính từ actual allocations.
Cancel, return và refund dùng compensating records; không hard-delete.

Test bắt buộc: hai checkout tranh lô cuối chỉ một thành công; một line lấy hai batch
có COGS đúng; expired batch bị bỏ; partial failure rollback; return/reversal khôi
phục tồn đúng; historical report không đổi khi master price đổi. Chạy toàn bộ
verification, cập nhật plan/contracts và append HANDOFF.
```

## Cách dùng

- Dùng **Master prompt** khi muốn agent tự chọn task kế tiếp theo plan.
- Dùng prompt phase khi muốn cố định phạm vi.
- Với task lớn, yêu cầu agent hoàn thành một work package như `P2.1 + P2.2`, không
  nên giao toàn Phase 2 nếu thời gian phiên làm việc bị giới hạn.
- Sau mỗi phiên, kiểm tra `HANDOFF.md` và checkbox trong implementation plan trước
  khi dùng lại prompt master.
