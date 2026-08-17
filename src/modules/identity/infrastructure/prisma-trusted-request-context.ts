import {
  MembershipRole,
  Prisma,
  SystemRole,
  type PrismaClient,
} from "@/generated/prisma/client";

import type { LocalUser } from "@/modules/identity/application/auth-context";
import type { ActiveMembership } from "@/modules/identity/application/store-context";
import { getSessionToken, hashSessionToken } from "@/modules/identity/application/session";

type TrustedContextDatabase = Pick<PrismaClient, "$queryRaw">;

export type TrustedRequestContext = {
  sessionId: string;
  lastUsedAt: Date;
  actor: LocalUser;
  memberships: ActiveMembership[];
};

type TrustedContextRow = {
  sessionId: string;
  lastUsedAt: Date;
  userId: string;
  email: string;
  displayName: string | null;
  isActive: boolean;
  emailVerifiedAt: Date | null;
  systemRole: SystemRole;
  membershipUserId: string | null;
  storeId: string | null;
  membershipRole: MembershipRole | null;
  storeCode: string | null;
  storeName: string | null;
  storeTimezone: string | null;
  storeIsActive: boolean | null;
};

/**
 * Reads the authenticated actor and all active store memberships in one actual
 * PostgreSQL statement. Prisma's nested relation select is intentionally not
 * used here because the driver adapter splits it into several SQL statements.
 * Expiry/revocation remain part of the query predicate and all values remain
 * parameterized through Prisma.sql.
 */
export async function readTrustedRequestContext(
  db: TrustedContextDatabase,
  rawToken: string,
): Promise<TrustedRequestContext | null> {
  const rows = await db.$queryRaw<TrustedContextRow[]>(Prisma.sql`
    WITH valid_session AS (
      SELECT
        session.id AS session_id,
        session.last_used_at,
        actor.id AS user_id,
        actor.email,
        actor.display_name,
        actor.is_active,
        actor.email_verified_at,
        actor.system_role
      FROM auth_sessions AS session
      INNER JOIN users AS actor ON actor.id = session.user_id
      WHERE session.token_hash = ${hashSessionToken(rawToken)}
        AND session.revoked_at IS NULL
        AND session.expires_at > CURRENT_TIMESTAMP
        AND actor.is_active = TRUE
      LIMIT 1
    )
    SELECT
      valid_session.session_id AS "sessionId",
      valid_session.last_used_at AS "lastUsedAt",
      valid_session.user_id AS "userId",
      valid_session.email,
      valid_session.display_name AS "displayName",
      valid_session.is_active AS "isActive",
      valid_session.email_verified_at AS "emailVerifiedAt",
      valid_session.system_role AS "systemRole",
      membership.user_id AS "membershipUserId",
      membership.store_id AS "storeId",
      membership.role AS "membershipRole",
      membership.store_code AS "storeCode",
      membership.store_name AS "storeName",
      membership.store_timezone AS "storeTimezone",
      membership.store_is_active AS "storeIsActive"
    FROM valid_session
    LEFT JOIN LATERAL (
      SELECT
        store_membership.user_id,
        store_membership.store_id,
        store_membership.role,
        store.code AS store_code,
        store.name AS store_name,
        store.timezone AS store_timezone,
        store.is_active AS store_is_active
      FROM memberships AS store_membership
      INNER JOIN stores AS store ON store.id = store_membership.store_id
      WHERE store_membership.user_id = valid_session.user_id
        AND store_membership.is_active = TRUE
        AND store.is_active = TRUE
      ORDER BY store.name ASC, store.id ASC
    ) AS membership ON TRUE
    ORDER BY membership.store_name ASC NULLS LAST, membership.store_id ASC NULLS LAST
  `);

  const session = rows[0];
  if (!session) return null;

  const memberships = rows.flatMap((row) => {
    if (
      row.membershipUserId === null
      || row.storeId === null
      || row.membershipRole === null
      || row.storeCode === null
      || row.storeName === null
      || row.storeTimezone === null
      || row.storeIsActive === null
    ) return [];

    return [{
      userId: row.membershipUserId,
      storeId: row.storeId,
      role: row.membershipRole,
      store: {
        id: row.storeId,
        code: row.storeCode,
        name: row.storeName,
        timezone: row.storeTimezone,
        isActive: row.storeIsActive,
      },
    }];
  });

  return {
    sessionId: session.sessionId,
    lastUsedAt: session.lastUsedAt,
    actor: {
      id: session.userId,
      email: session.email,
      displayName: session.displayName,
      isActive: session.isActive,
      emailVerifiedAt: session.emailVerifiedAt,
      systemRole: session.systemRole,
    },
    memberships,
  };
}

export async function getTrustedRequestContext(db: TrustedContextDatabase) {
  const rawToken = await getSessionToken();
  return rawToken ? readTrustedRequestContext(db, rawToken) : null;
}
