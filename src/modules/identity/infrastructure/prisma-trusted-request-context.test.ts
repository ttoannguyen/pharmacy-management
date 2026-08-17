import { describe, expect, it, vi } from "vitest";

import { MembershipRole, SystemRole } from "@/generated/prisma/client";

import { readTrustedRequestContext } from "./prisma-trusted-request-context";

const userId = "10000000-0000-4000-8000-000000000001";
const storeId = "20000000-0000-4000-8000-000000000001";

function makeDb(session: unknown) {
  const findFirst = vi.fn().mockResolvedValue(session);
  return { db: { authSession: { findFirst } }, findFirst };
}

const session = {
  id: "session-1",
  lastUsedAt: new Date("2026-08-17T00:00:00Z"),
  user: {
    id: userId,
    email: "owner@example.com",
    displayName: "Owner",
    isActive: true,
    emailVerifiedAt: null,
    systemRole: SystemRole.USER,
    memberships: [{
      userId,
      storeId,
      role: MembershipRole.OWNER,
      store: { id: storeId, code: "DEMO", name: "Demo", timezone: "Asia/Bangkok", isActive: true },
    }],
  },
};

describe("readTrustedRequestContext", () => {
  it("reads session, actor and active memberships with one scoped query", async () => {
    const { db, findFirst } = makeDb(session);
    const result = await readTrustedRequestContext(db as never, "opaque-session-token");

    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ revokedAt: null, expiresAt: expect.any(Object), tokenHash: expect.any(String) }),
      select: expect.objectContaining({ user: expect.any(Object) }),
    }));
    expect(result?.actor.id).toBe(userId);
    expect(result?.actor.systemRole).toBe(SystemRole.USER);
    expect(result?.memberships[0]?.storeId).toBe(storeId);
  });

  it("rejects missing, revoked or expired sessions through the query result", async () => {
    const { db } = makeDb(null);
    await expect(readTrustedRequestContext(db as never, "expired-or-revoked")).resolves.toBeNull();
  });
});
