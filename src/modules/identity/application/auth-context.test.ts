import { describe, expect, it } from "vitest";

import { SystemRole } from "@/generated/prisma/client";

import { UnauthorizedError, requireLocalUser } from "./auth-context";

const activeUser = {
  id: "local-user-1",
  email: "staff@example.test",
  displayName: "Staff",
  isActive: true,
  emailVerifiedAt: null,
  systemRole: SystemRole.USER,
};

describe("requireLocalUser", () => {
  it("rejects an absent or inactive session user", async () => {
    await expect(requireLocalUser({ readCurrentUser: async () => null })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    await expect(
      requireLocalUser({ readCurrentUser: async () => ({ ...activeUser, isActive: false }) }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("returns an active user from the server-side session reader", async () => {
    await expect(requireLocalUser({ readCurrentUser: async () => activeUser })).resolves.toEqual(activeUser);
  });
});
