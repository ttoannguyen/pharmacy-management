import type { MembershipRole } from "@/generated/prisma/client";

import {
  ForbiddenError,
  StoreSelectionRequiredError,
  UnauthorizedError,
} from "./auth-errors";
import type { LocalUser } from "./auth-context";

export type ActiveMembership = {
  userId: string;
  storeId: string;
  role: MembershipRole;
  store: { id: string; code: string; name: string; timezone: string; isActive: boolean };
};

export type StoreContext = {
  actor: LocalUser;
  store: ActiveMembership["store"];
  storeId: string;
  role: MembershipRole;
};

type StoreSummary = Pick<ActiveMembership["store"], "id" | "code" | "name">;

export function resolveStoreContext(input: {
  actor: LocalUser | null;
  memberships: readonly ActiveMembership[];
  selectedStoreId?: string | null;
}): StoreContext {
  if (!input.actor || !input.actor.isActive) {
    throw new UnauthorizedError();
  }

  const memberships = input.memberships.filter(
    (membership) => membership.userId === input.actor?.id && membership.store.isActive,
  );

  if (memberships.length === 0) {
    throw new ForbiddenError("Your account has no active store membership.");
  }

  if (input.selectedStoreId) {
    const selected = memberships.find((membership) => membership.storeId === input.selectedStoreId);

    if (!selected) {
      throw new ForbiddenError("You are not an active member of the selected store.");
    }

    return {
      actor: input.actor,
      store: selected.store,
      storeId: selected.storeId,
      role: selected.role,
    };
  }

  if (memberships.length > 1) {
    const stores: StoreSummary[] = memberships.map(({ store }) => ({
      id: store.id,
      code: store.code,
      name: store.name,
    }));
    throw new StoreSelectionRequiredError(stores);
  }

  const [membership] = memberships;
  return {
    actor: input.actor,
    store: membership.store,
    storeId: membership.storeId,
    role: membership.role,
  };
}
