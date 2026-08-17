import { describe, expect, it, vi } from "vitest";

import { MembershipRole, SystemRole } from "@/generated/prisma/client";

import { readTrustedRequestContext } from "./prisma-trusted-request-context";

const userId = "10000000-0000-4000-8000-000000000001";
const storeId = "20000000-0000-4000-8000-000000000001";

function makeDb(session: unknown) {
  const queryRaw = vi.fn().mockResolvedValue(session);
  return { db: { $queryRaw: queryRaw }, queryRaw };
}

const session = [{
  sessionId: "30000000-0000-4000-8000-000000000001",
  lastUsedAt: new Date("2026-08-17T00:00:00Z"),
  userId,
  email: "owner@example.com",
  displayName: "Owner",
  isActive: true,
  emailVerifiedAt: null,
  systemRole: SystemRole.USER,
  membershipUserId: userId,
  storeId,
  membershipRole: MembershipRole.OWNER,
  storeCode: "DEMO",
  storeName: "Demo",
  storeTimezone: "Asia/Bangkok",
  storeIsActive: true,
}];

describe("readTrustedRequestContext", () => {
  it("reads session, actor and active memberships with one scoped query", async () => {
    const { db, queryRaw } = makeDb(session);
    const result = await readTrustedRequestContext(db as never, "opaque-session-token");

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const statement = queryRaw.mock.calls[0]?.[0];
    expect(statement.values).toHaveLength(1);
    expect(statement.values[0]).not.toBe("opaque-session-token");
    expect(statement.strings.join("?")).toContain("session.revoked_at IS NULL");
    expect(statement.strings.join("?")).toContain("session.expires_at > CURRENT_TIMESTAMP");
    expect(statement.strings.join("?")).toContain("actor.is_active = TRUE");
    expect(statement.strings.join("?")).toContain("store_membership.is_active = TRUE");
    expect(statement.strings.join("?")).toContain("store.is_active = TRUE");
    expect(result?.actor.id).toBe(userId);
    expect(result?.actor.systemRole).toBe(SystemRole.USER);
    expect(result?.memberships[0]?.storeId).toBe(storeId);
  });

  it("rejects missing, revoked or expired sessions through the query result", async () => {
    const { db } = makeDb([]);
    await expect(readTrustedRequestContext(db as never, "expired-or-revoked")).resolves.toBeNull();
  });

  it("preserves an authenticated actor when no active store membership exists", async () => {
    const row = {
      ...session[0],
      membershipUserId: null,
      storeId: null,
      membershipRole: null,
      storeCode: null,
      storeName: null,
      storeTimezone: null,
      storeIsActive: null,
    };
    const { db } = makeDb([row]);

    await expect(readTrustedRequestContext(db as never, "system-admin-token")).resolves.toMatchObject({
      actor: { id: userId },
      memberships: [],
    });
  });
});
