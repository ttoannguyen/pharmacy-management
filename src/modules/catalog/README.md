# Catalog module

Module này sở hữu global reference catalog và store-local catalog.

## Boundary

- Shared: DrugConcept, Ingredient, Manufacturer, RegisteredProduct,
  RegisteredProductVersion, ProductPackage, GlobalBarcode.
- Store-owned: StoreProduct, StoreSku, StoreBarcode.
- Moderation: CatalogSubmission.

## Lookup order

1. Exact StoreBarcode trong active store.
2. Verified GlobalBarcode.
3. Quick-create local product với barcode được điền sẵn.

Store customization chỉ tạo override và không sửa shared record. Xem thêm
`docs/domain/business-rules.md` và `docs/data/medicine-catalog-strategy.md`.

Repository boundary:

- Store queries luôn nhận `storeId` từ trusted active context.
- Global lookup mặc định chỉ trả package và product đã `VERIFIED`.
- Barcode được chuẩn hóa để lookup; raw input nên được giữ ở application/audit
  boundary khi cần truy vết thao tác scanner.
- Client catalog dùng TanStack Query cho cache search và invalidate sau mutation;
  server vẫn là nguồn kiểm tra quyền và tenant cuối cùng.

## Product detail API

- `GET /api/catalog/products/:id` trả detail của active store, không nhận
  `storeId` từ client.
- `POST /api/catalog/products/:id/skus` thêm một `StoreSku` trong transaction,
  normalize code/barcode, kiểm tra duplicate theo store và ghi audit cùng
  transaction.
- `PATCH /api/catalog/products/:id/skus/:skuId` archive SKU theo tenant; không
  hard-delete và không cho archive SKU cuối cùng còn hoạt động của sản phẩm.
- Detail UI ở `/dashboard/catalog/:id` dùng server-rendered initial data rồi
  hydrate TanStack Query; mutation thành công chỉ invalidate detail, catalog list
  và overview keys liên quan.
