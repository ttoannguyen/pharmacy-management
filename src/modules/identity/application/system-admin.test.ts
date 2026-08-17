import { describe, expect, it, vi } from "vitest";

import { SystemRole } from "@/generated/prisma/client";

import { ForbiddenError } from "./auth-errors";
import { getSystemAdminOverview } from "./system-admin";

const user = {
  id: "user-1",
  email: "user@example.test",
  displayName: "User",
  isActive: true,
  emailVerifiedAt: null,
  systemRole: SystemRole.USER,
};

describe("system admin overview", () => {
  it("rejects a store owner without global system role before reading global data", async () => {
    const readOverview = vi.fn();
    expect(() => getSystemAdminOverview(user, { readOverview })).toThrow(ForbiddenError);
    expect(readOverview).not.toHaveBeenCalled();
  });

  it("allows an active system admin to read global overview", async () => {
    const overview = { activeUsers: 3, activeStores: 2, registeredProducts: 10, pendingCatalogSubmissions: 1 };
    const readOverview = vi.fn().mockResolvedValue(overview);
    await expect(getSystemAdminOverview({ ...user, systemRole: SystemRole.SYSTEM_ADMIN }, { readOverview })).resolves.toEqual(overview);
  });
});
