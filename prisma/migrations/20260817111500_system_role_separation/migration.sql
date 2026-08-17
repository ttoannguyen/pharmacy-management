BEGIN;

CREATE TYPE "SystemRole" AS ENUM ('USER', 'SYSTEM_ADMIN');

ALTER TABLE "users"
ADD COLUMN "system_role" "SystemRole" NOT NULL DEFAULT 'USER';

CREATE INDEX "users_system_role_is_active_idx"
ON "users"("system_role", "is_active");

-- SYSTEM_ADMIN used to be a store membership role. Promote any legacy actor to
-- the new control-plane role and preserve the existing tenant assignment as
-- store ownership before recreating the membership enum.
UPDATE "users"
SET "system_role" = 'SYSTEM_ADMIN'
WHERE "id" IN (
  SELECT DISTINCT "user_id"
  FROM "memberships"
  WHERE "role" = 'SYSTEM_ADMIN'
);

UPDATE "memberships"
SET "role" = 'OWNER'
WHERE "role" = 'SYSTEM_ADMIN';

ALTER TYPE "MembershipRole" RENAME TO "MembershipRole_legacy";
CREATE TYPE "MembershipRole" AS ENUM (
  'OWNER',
  'PHARMACIST',
  'CLINICIAN',
  'INVENTORY_STAFF',
  'ACCOUNTANT'
);

ALTER TABLE "memberships"
ALTER COLUMN "role" TYPE "MembershipRole"
USING ("role"::text::"MembershipRole");

DROP TYPE "MembershipRole_legacy";

COMMIT;
