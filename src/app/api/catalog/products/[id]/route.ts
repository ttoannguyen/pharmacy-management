import { apiError, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { StoreSelectionRequiredError, UnauthorizedError, ForbiddenError } from "@/modules/identity/application/auth-errors";
import { getCurrentStoreContextWithTelemetry } from "@/modules/identity/infrastructure/current-store-context";
import { createPrismaStoreProductDetailRepository } from "@/modules/catalog/infrastructure/prisma-catalog-repositories";
import { storeProductOverrideSchema } from "@/modules/catalog/application/store-product-service";
import { updateStoreProductOverride } from "@/modules/catalog/infrastructure/prisma-store-product-service";
import { createRequestObservability } from "@/lib/request-observability";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const telemetry = createRequestObservability(request);
  try {
    const context = await getCurrentStoreContextWithTelemetry(telemetry);
    const { id } = await params;
    const detail = await telemetry.phase("repository", () => createPrismaStoreProductDetailRepository(prisma).findById(context.storeId, id));
    if (!detail) return telemetry.finish(telemetry.phaseSync("serialize", () => apiError("Product not found.", "CATALOG_NOT_FOUND", 404)));
    return telemetry.finish(telemetry.phaseSync("serialize", () => apiSuccess({ product: detail }, "Store product loaded.")));
  } catch (error) {
    return telemetry.finish(telemetry.phaseSync("serialize", () => {
      if (error instanceof UnauthorizedError) return apiError(error.message, error.code, 401);
      if (error instanceof ForbiddenError) return apiError(error.message, error.code, 403);
      if (error instanceof StoreSelectionRequiredError) return apiError(error.message, error.code, 409, { stores: error.stores });
      return apiError("Catalog service is unavailable.", "CATALOG_UNAVAILABLE", 503);
    }));
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const telemetry = createRequestObservability(request);
  try {
    const context = await getCurrentStoreContextWithTelemetry(telemetry);
    const { id } = await params;
    const parsed = storeProductOverrideSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return telemetry.finish(telemetry.phaseSync("serialize", () => apiError("Invalid product override.", "VALIDATION_ERROR", 422, { issues: parsed.error.issues })));
    const product = await telemetry.phase("repository", () => updateStoreProductOverride(prisma, context, context.storeId, id, parsed.data));
    return telemetry.finish(telemetry.phaseSync("serialize", () => apiSuccess({ product }, "Store product updated.")));
  } catch (error) {
    return telemetry.finish(telemetry.phaseSync("serialize", () => {
      if (error instanceof UnauthorizedError) return apiError(error.message, error.code, 401);
      if (error instanceof ForbiddenError) return apiError(error.message, error.code, 403);
      if (error instanceof StoreSelectionRequiredError) return apiError(error.message, error.code, 409, { stores: error.stores });
      return apiError("Catalog service is unavailable.", "CATALOG_UNAVAILABLE", 503);
    }));
  }
}
