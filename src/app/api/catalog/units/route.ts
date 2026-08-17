import { apiError, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { UnauthorizedError } from "@/modules/identity/application/auth-errors";
import { getCurrentStoreContext } from "@/modules/identity/infrastructure/current-store-context";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getCurrentStoreContext();
    const units = await prisma.unit.findMany({ orderBy: { name: "asc" }, select: { id: true, code: true, name: true } });
    return apiSuccess({ units }, "Units loaded.");
  } catch (error) {
    if (error instanceof UnauthorizedError) return apiError(error.message, error.code, 401);
    return apiError("Catalog service is unavailable.", "CATALOG_UNAVAILABLE", 503);
  }
}
