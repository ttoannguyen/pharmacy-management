import { apiError, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { StoreSelectionRequiredError, UnauthorizedError, ForbiddenError } from "@/modules/identity/application/auth-errors";
import { addStoreSkuSchema, CatalogConflictError, CatalogNotFoundError } from "@/modules/catalog/application/store-product-service";
import { addStoreSku } from "@/modules/catalog/infrastructure/prisma-store-product-service";
import { getCurrentStoreContext } from "@/modules/identity/infrastructure/current-store-context";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getCurrentStoreContext();
    const { id } = await params;
    const parsed = addStoreSkuSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError("Invalid SKU input.", "VALIDATION_ERROR", 422, { issues: parsed.error.issues });
    const sku = await addStoreSku(prisma, context, context.storeId, id, parsed.data);
    return apiSuccess({ sku }, "SKU created.", 201);
  } catch (error) {
    if (error instanceof UnauthorizedError) return apiError(error.message, error.code, 401);
    if (error instanceof ForbiddenError) return apiError(error.message, error.code, 403);
    if (error instanceof StoreSelectionRequiredError) return apiError(error.message, error.code, 409, { stores: error.stores });
    if (error instanceof CatalogConflictError) return apiError(error.message, error.code, 409);
    if (error instanceof CatalogNotFoundError) return apiError(error.message, error.code, 404);
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return apiError("SKU code or barcode already exists in this store.", "CATALOG_CONFLICT", 409);
    return apiError("Catalog service is unavailable.", "CATALOG_UNAVAILABLE", 503);
  }
}
