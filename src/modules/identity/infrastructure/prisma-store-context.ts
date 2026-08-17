import type { PrismaClient } from "@/generated/prisma/client";

import { getCurrentUser } from "@/modules/identity/application/session";
import { resolveStoreContext, type ActiveMembership } from "@/modules/identity/application/store-context";

type StoreContextDatabase = Pick<PrismaClient, "membership">;

const membershipSelect = {
  userId: true,
  storeId: true,
  role: true,
  store: { select: { id: true, code: true, name: true, timezone: true, isActive: true } },
} as const;

export async function getActiveMemberships(
  db: StoreContextDatabase,
  userId: string,
): Promise<ActiveMembership[]> {
  return db.membership.findMany({
    where: { userId, isActive: true, store: { isActive: true } },
    select: membershipSelect,
    orderBy: { store: { name: "asc" } },
  });
}

export async function getStoreOptions(db: StoreContextDatabase, userId: string) {
  const memberships = await getActiveMemberships(db, userId);
  return memberships.map(({ userId: memberUserId, storeId, role, store }) => ({
    userId: memberUserId,
    storeId,
    role,
    store,
  }));
}

export async function resolveCurrentStoreContext(
  db: StoreContextDatabase & Pick<PrismaClient, "authSession">,
  selectedStoreId?: string | null,
) {
  const actor = await getCurrentUser(db);
  const memberships = actor ? await getActiveMemberships(db, actor.id) : [];
  return resolveStoreContext({ actor, memberships, selectedStoreId });
}
