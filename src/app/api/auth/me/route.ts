import { UnauthorizedError, requireLocalUser } from "@/modules/identity/application/auth-context";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createRequestObservability } from "@/lib/request-observability";
import { getCurrentActor } from "@/modules/identity/infrastructure/current-store-context";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const telemetry = createRequestObservability(request);
  try {
    const user = await telemetry.phase("auth", () => requireLocalUser({ readCurrentUser: getCurrentActor }));
    return telemetry.finish(telemetry.phaseSync("serialize", () => apiSuccess({ user }, "Authenticated user loaded.")));
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return telemetry.finish(telemetry.phaseSync("serialize", () => apiError(error.message, error.code, 401)));
    }
    return telemetry.finish(telemetry.phaseSync("serialize", () => apiError("Authentication service is unavailable.", "AUTH_UNAVAILABLE", 503)));
  }
}
