import { apiError, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { StoreSelectionRequiredError, UnauthorizedError, ForbiddenError } from "@/modules/identity/application/auth-errors";
import { getCurrentStoreContextWithTelemetry } from "@/modules/identity/infrastructure/current-store-context";
import { createPrismaStoreCatalogRepository } from "@/modules/catalog/infrastructure/prisma-catalog-repositories";
import { createStoreProduct } from "@/modules/catalog/infrastructure/prisma-store-product-service";
import { storeProductInputSchema } from "@/modules/catalog/application/store-product-service";
import { createRequestObservability } from "@/lib/request-observability";

export const dynamic = "force-dynamic";

function handleError(error: unknown) {
  if (error instanceof UnauthorizedError) return apiError(error.message, error.code, 401);
  if (error instanceof ForbiddenError) return apiError(error.message, error.code, 403);
  if (error instanceof StoreSelectionRequiredError) return apiError(error.message, error.code, 409, { stores: error.stores });
  return apiError("Catalog service is unavailable.", "CATALOG_UNAVAILABLE", 503);
}

export async function GET(request: Request) {
  const telemetry = createRequestObservability(request);
  try {
    const context = await getCurrentStoreContextWithTelemetry(telemetry);
    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? "";
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
    const includeTotal = url.searchParams.get("includeTotal") === "true";
    const result = await telemetry.phase("repository", () => createPrismaStoreCatalogRepository(prisma).search(context.storeId, query, { page, pageSize }, { includeTotal }));
    return telemetry.finish(telemetry.phaseSync("serialize", () => apiSuccess(result, "Store products loaded.")));
  } catch (error) {
    return telemetry.finish(telemetry.phaseSync("serialize", () => handleError(error)));
  }
}

export async function POST(request: Request) {
  const telemetry = createRequestObservability(request);
  try {
    const context = await getCurrentStoreContextWithTelemetry(telemetry);
    const body = await request.json().catch(() => null);
    const parsed = storeProductInputSchema.safeParse(
      body && typeof body === "object" ? { ...body as Record<string, unknown>, storeId: context.storeId } : body,
    );
    if (!parsed.success) return telemetry.finish(telemetry.phaseSync("serialize", () => apiError("Invalid store product input.", "VALIDATION_ERROR", 422, { issues: parsed.error.issues })));
    const product = await telemetry.phase("repository", () => createStoreProduct(prisma, context, parsed.data));
    return telemetry.finish(telemetry.phaseSync("serialize", () => apiSuccess({ product }, "Store product created.")));
  } catch (error) {
    return telemetry.finish(telemetry.phaseSync("serialize", () => handleError(error)));
  }
}
