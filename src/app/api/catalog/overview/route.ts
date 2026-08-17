import { apiError, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { createRequestObservability } from "@/lib/request-observability";
import {
  ForbiddenError,
  StoreSelectionRequiredError,
  UnauthorizedError,
} from "@/modules/identity/application/auth-errors";
import { getCatalogOverview } from "@/modules/catalog/application/catalog-overview";
import { createPrismaCatalogOverviewRepository } from "@/modules/catalog/infrastructure/prisma-catalog-overview";
import { getCurrentStoreContextWithTelemetry } from "@/modules/identity/infrastructure/current-store-context";

export const dynamic = "force-dynamic";

function handleError(error: unknown) {
  if (error instanceof UnauthorizedError) return apiError(error.message, error.code, 401);
  if (error instanceof ForbiddenError) return apiError(error.message, error.code, 403);
  if (error instanceof StoreSelectionRequiredError) {
    return apiError(error.message, error.code, 409, { stores: error.stores });
  }
  return apiError("Catalog overview is unavailable.", "CATALOG_OVERVIEW_UNAVAILABLE", 503);
}

export async function GET(request: Request) {
  const telemetry = createRequestObservability(request);
  try {
    const context = await getCurrentStoreContextWithTelemetry(telemetry);
    const overview = await telemetry.phase("repository", () => getCatalogOverview(
      createPrismaCatalogOverviewRepository(prisma),
      context.storeId,
    ));
    return telemetry.finish(telemetry.phaseSync("serialize", () => apiSuccess(overview, "Catalog overview loaded.")));
  } catch (error) {
    return telemetry.finish(telemetry.phaseSync("serialize", () => handleError(error)));
  }
}
