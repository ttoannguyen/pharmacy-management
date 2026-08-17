import { describe, expect, it } from "vitest";

import { MembershipRole, SystemRole } from "@/generated/prisma/client";

import { ForbiddenError } from "./auth-errors";
import { can, canSystem, requirePermission, requireStoreAccess, requireSystemAdmin } from "./authorization";
import type { StoreContext } from "./store-context";

const context = (role: MembershipRole, storeId = "store-a"): StoreContext => ({
  actor: { id: "user-1", email: "user@example.com", displayName: null, isActive: true, emailVerifiedAt: null, systemRole: SystemRole.USER },
  store: { id: storeId, code: storeId, name: "Store", timezone: "Asia/Bangkok", isActive: true },
  storeId,
  role,
});

describe("authorization policy", () => {
  it("allows role-specific operations", () => {
    expect(can(MembershipRole.OWNER, "MANAGE_FINANCE")).toBe(true);
    expect(can(MembershipRole.ACCOUNTANT, "MANAGE_FINANCE")).toBe(true);
    expect(can(MembershipRole.ACCOUNTANT, "SELL_MEDICINE")).toBe(false);
    expect(can(MembershipRole.INVENTORY_STAFF, "MANAGE_INVENTORY")).toBe(true);
    expect(can(MembershipRole.PHARMACIST, "MANAGE_INVENTORY")).toBe(false);
  });

  it("forbids a role before mutation", () => {
    expect(() => requirePermission(context(MembershipRole.ACCOUNTANT), "SELL_MEDICINE")).toThrow(ForbiddenError);
  });

  it("enforces tenant isolation even when a resource id is supplied", () => {
    expect(() => requireStoreAccess(context(MembershipRole.OWNER), "store-b")).toThrow(ForbiddenError);
    expect(requireStoreAccess(context(MembershipRole.OWNER), "store-a").storeId).toBe("store-a");
  });

  it("keeps platform administration separate from store ownership", () => {
    const owner = context(MembershipRole.OWNER).actor;
    const systemAdmin = { ...owner, systemRole: SystemRole.SYSTEM_ADMIN };

    expect(canSystem(owner.systemRole, "ACCESS_SYSTEM_ADMIN")).toBe(false);
    expect(() => requireSystemAdmin(owner)).toThrow(ForbiddenError);
    expect(requireSystemAdmin(systemAdmin)).toBe(systemAdmin);
  });
});
