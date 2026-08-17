import type { PrismaClient } from "@/generated/prisma/client";

import type { LocalUser } from "@/modules/identity/application/auth-context";
import type { ActiveMembership } from "@/modules/identity/application/store-context";
import { getSessionToken, hashSessionToken } from "@/modules/identity/application/session";

type TrustedContextDatabase = Pick<PrismaClient, "authSession">;

export type TrustedRequestContext = {
  sessionId: string;
  lastUsedAt: Date;
  actor: LocalUser;
  memberships: ActiveMembership[];
};

const trustedContextSelect = {
  id: true,
  lastUsedAt: true,
  user: {
    select: {
      id: true,
      email: true,
      displayName: true,
      isActive: true,
      emailVerifiedAt: true,
      systemRole: true,
      memberships: {
        where: { isActive: true, store: { isActive: true } },
        select: {
          userId: true,
          storeId: true,
          role: true,
          store: { select: { id: true, code: true, name: true, timezone: true, isActive: true } },
        },
        orderBy: { store: { name: "asc" } },
      },
    },
  },
} as const;

/**
 * Reads the authenticated actor and all active store memberships in one
 * database operation. Expiry/revocation remain part of the query predicate.
 * The last-used timestamp is returned for PERF-1.2's deferred touch.
 */
export async function readTrustedRequestContext(
  db: TrustedContextDatabase,
  rawToken: string,
): Promise<TrustedRequestContext | null> {
  const session = await db.authSession.findFirst({
    where: {
      tokenHash: hashSessionToken(rawToken),
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: trustedContextSelect,
  });

  if (!session) return null;
  return {
    sessionId: session.id,
    lastUsedAt: session.lastUsedAt,
    actor: session.user,
    memberships: session.user.memberships,
  };
}

export async function getTrustedRequestContext(db: TrustedContextDatabase) {
  const rawToken = await getSessionToken();
  return rawToken ? readTrustedRequestContext(db, rawToken) : null;
}
