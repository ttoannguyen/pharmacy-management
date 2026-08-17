import { UnauthorizedError, requireLocalUser } from "@/modules/identity/application/auth-context";
import { getCurrentUser } from "@/modules/identity/application/session";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createRequestObservability } from "@/lib/request-observability";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const telemetry = createRequestObservability(request);
  try {
    const user = await telemetry.phase("auth", () => requireLocalUser({ getCurrentUser: () => getCurrentUser(prisma) }));
    return telemetry.finish(telemetry.phaseSync("serialize", () => apiSuccess({ user }, "Authenticated user loaded.")));
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return telemetry.finish(telemetry.phaseSync("serialize", () => apiError(error.message, error.code, 401)));
    }
    return telemetry.finish(telemetry.phaseSync("serialize", () => apiError("Authentication service is unavailable.", "AUTH_UNAVAILABLE", 503)));
  }
}
