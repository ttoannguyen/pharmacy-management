import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import {
  ForbiddenError,
  StoreSelectionRequiredError,
  UnauthorizedError,
} from "@/modules/identity/application/auth-errors";
import { resolveStoreContext } from "@/modules/identity/application/store-context";
import { getTrustedRequestContext } from "@/modules/identity/infrastructure/prisma-trusted-request-context";
import {
  clearSelectedStoreId,
  getSelectedStoreId,
  setSelectedStoreId,
} from "@/modules/identity/infrastructure/active-store-cookie";

export const dynamic = "force-dynamic";

const selectStoreSchema = z.object({ storeId: z.uuid() });

function errorResponse(message: string, code: string, status: number, data: unknown = null) {
  return apiError(message, code, status, data && typeof data === "object" ? data as Record<string, unknown> : null);
}

export async function GET() {
  try {
    const [trustedContext, selectedStoreId] = await Promise.all([
      getTrustedRequestContext(prisma),
      getSelectedStoreId(),
    ]);
    if (!trustedContext) throw new UnauthorizedError();
    const stores = trustedContext.memberships.map(({ userId, storeId, role, store }) => ({ userId, storeId, role, store }));

    let activeStore = null;
    try {
      activeStore = resolveStoreContext({ actor: trustedContext.actor, memberships: trustedContext.memberships, selectedStoreId }).store;
    } catch (error) {
      if (!(error instanceof StoreSelectionRequiredError)) throw error;
    }

    return apiSuccess({ stores, activeStore }, "Available stores loaded.");
  } catch (error) {
    if (error instanceof UnauthorizedError) return errorResponse(error.message, error.code, 401);
    if (error instanceof ForbiddenError) return errorResponse(error.message, error.code, 403);
    return errorResponse("Store service is unavailable.", "STORE_UNAVAILABLE", 503);
  }
}

export async function POST(request: Request) {
  try {
    const trustedContext = await getTrustedRequestContext(prisma);
    if (!trustedContext) throw new UnauthorizedError();
    const body = selectStoreSchema.parse(await request.json());
    const selected = trustedContext.memberships.find((membership) => membership.storeId === body.storeId);

    if (!selected) {
      return errorResponse("You are not an active member of the selected store.", "FORBIDDEN", 403);
    }

    await setSelectedStoreId(selected.storeId);
    return apiSuccess({ store: selected.store, role: selected.role }, "Active store selected.");
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse("Invalid store selection.", "VALIDATION_ERROR", 422);
    if (error instanceof UnauthorizedError) return errorResponse(error.message, error.code, 401);
    return errorResponse("Store service is unavailable.", "STORE_UNAVAILABLE", 503);
  }
}

export async function DELETE() {
  await clearSelectedStoreId();
  return apiSuccess(null, "Active store selection cleared.");
}
