import { describe, expect, it } from "vitest";

import { MembershipRole, SystemRole } from "@/generated/prisma/client";

import {
  ForbiddenError,
  StoreSelectionRequiredError,
  UnauthorizedError,
} from "./auth-errors";
import { resolveStoreContext, type ActiveMembership } from "./store-context";

const actor = {
  id: "user-1",
  email: "owner@example.com",
  displayName: "Owner",
  isActive: true,
  emailVerifiedAt: null,
  systemRole: SystemRole.USER,
};

function membership(
  storeId: string,
  name: string,
  role: MembershipRole = MembershipRole.OWNER,
): ActiveMembership {
  return {
    userId: actor.id,
    storeId,
    role,
    store: { id: storeId, code: storeId.toUpperCase(), name, timezone: "Asia/Bangkok", isActive: true },
  };
}

describe("resolveStoreContext", () => {
  it("rejects unauthenticated actors", () => {
    expect(() => resolveStoreContext({ actor: null, memberships: [] })).toThrow(UnauthorizedError);
  });

  it("selects the only active membership without trusting request store ids", () => {
    const context = resolveStoreContext({ actor, memberships: [membership("store-a", "A")] });
    expect(context.storeId).toBe("store-a");
    expect(context.role).toBe(MembershipRole.OWNER);
  });

  it("requires explicit selection for multiple stores", () => {
    expect(() =>
      resolveStoreContext({ actor, memberships: [membership("store-a", "A"), membership("store-b", "B")] }),
    ).toThrow(StoreSelectionRequiredError);
  });

  it("accepts a selected member store and rejects a foreign store", () => {
    const context = resolveStoreContext({
      actor,
      memberships: [membership("store-a", "A"), membership("store-b", "B", MembershipRole.PHARMACIST)],
      selectedStoreId: "store-b",
    });
    expect(context.storeId).toBe("store-b");
    expect(context.role).toBe(MembershipRole.PHARMACIST);

    expect(() =>
      resolveStoreContext({ actor, memberships: [membership("store-a", "A")], selectedStoreId: "store-b" }),
    ).toThrow(ForbiddenError);
  });

  it("ignores inactive stores", () => {
    const inactive = membership("store-a", "A");
    inactive.store.isActive = false;
    expect(() => resolveStoreContext({ actor, memberships: [inactive] })).toThrow(ForbiddenError);
  });

  it("does not turn global system administration into an implicit store membership", () => {
    expect(() => resolveStoreContext({
      actor: { ...actor, systemRole: SystemRole.SYSTEM_ADMIN },
      memberships: [],
    })).toThrow(ForbiddenError);
  });
});
