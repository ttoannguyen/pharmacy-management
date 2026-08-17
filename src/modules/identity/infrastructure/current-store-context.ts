import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { after } from "next/server";
import { touchSessionBestEffort } from "@/modules/identity/application/session";
import { StoreSelectionRequiredError } from "@/modules/identity/application/auth-errors";
import { resolveStoreContext } from "@/modules/identity/application/store-context";
import { getSelectedStoreId } from "./active-store-cookie";
import { getTrustedRequestContext } from "./prisma-trusted-request-context";

const getCurrentStoreContextInput = cache(async () => {
  const [trustedContext, selectedStoreId] = await Promise.all([
    getTrustedRequestContext(prisma),
    getSelectedStoreId(),
  ]);
  if (trustedContext?.sessionId && trustedContext.lastUsedAt) {
    after(() => touchSessionBestEffort(prisma, trustedContext.sessionId, trustedContext.lastUsedAt));
  }

  return {
    actor: trustedContext?.actor ?? null,
    memberships: trustedContext?.memberships ?? [],
    selectedStoreId,
    sessionId: trustedContext?.sessionId ?? null,
    lastUsedAt: trustedContext?.lastUsedAt ?? null,
  };
});

type ContextTelemetry = {
  phase<T>(name: "auth", operation: () => Promise<T>): Promise<T>;
  phaseSync<T>(name: "membership", operation: () => T): T;
};

/**
 * Instrumented variant for API handlers. The database read is the auth phase;
 * membership is the synchronous server-side store selection/authorization step.
 * Keeping the loader request-cached preserves the same context for RSC and APIs.
 */
export async function getCurrentStoreContextWithTelemetry(telemetry: ContextTelemetry) {
  const input = await telemetry.phase("auth", getCurrentStoreContextInput);
  return telemetry.phaseSync("membership", () => resolveStoreContext(input));
}

export const getCurrentStoreContext = cache(async () => {
  return resolveStoreContext(await getCurrentStoreContextInput());
});

export const getCurrentWorkspaceState = cache(async () => {
  const input = await getCurrentStoreContextInput();
  let activeStore = null;
  try {
    activeStore = resolveStoreContext(input);
  } catch (error) {
    if (!(error instanceof StoreSelectionRequiredError)) throw error;
  }
  return {
    ...input,
    activeStore,
  };
});
