import { apiError, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { CatalogConflictError, CatalogNotFoundError, archiveStoreSkuSchema, updateStoreSkuSchema } from "@/modules/catalog/application/store-product-service";
import { archiveStoreSku, updateStoreSku } from "@/modules/catalog/infrastructure/prisma-store-product-service";
import { ForbiddenError, StoreSelectionRequiredError, UnauthorizedError } from "@/modules/identity/application/auth-errors";
import { getCurrentStoreContext } from "@/modules/identity/infrastructure/current-store-context";

export const dynamic = "force-dynamic";

function handleError(error: unknown) {
  if (error instanceof UnauthorizedError) return apiError(error.message, error.code, 401);
  if (error instanceof ForbiddenError) return apiError(error.message, error.code, 403);
  if (error instanceof StoreSelectionRequiredError) return apiError(error.message, error.code, 409, { stores: error.stores });
  if (error instanceof CatalogNotFoundError) return apiError(error.message, error.code, 404);
  if (error instanceof CatalogConflictError) return apiError(error.message, error.code, 409);
  return apiError("Catalog service is unavailable.", "CATALOG_UNAVAILABLE", 503);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; skuId: string }> }) {
  try {
    const context = await getCurrentStoreContext();
    const { id, skuId } = await params;
    const parsed = updateStoreSkuSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError("Invalid SKU update.", "VALIDATION_ERROR", 422, { issues: parsed.error.issues });
    const sku = await updateStoreSku(prisma, context, context.storeId, id, skuId, parsed.data);
    return apiSuccess({ sku }, "Store SKU price and conversion updated.");
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; skuId: string }> }) {
  try {
    const context = await getCurrentStoreContext();
    const { id, skuId } = await params;
    const parsed = archiveStoreSkuSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError("Invalid archive request.", "VALIDATION_ERROR", 422, { issues: parsed.error.issues });
    const sku = await archiveStoreSku(prisma, context, context.storeId, id, skuId, parsed.data);
    return apiSuccess({ sku }, "Store SKU archived.");
  } catch (error) {
    return handleError(error);
  }
}
