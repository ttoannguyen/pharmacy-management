import type { MembershipRole } from "@/generated/prisma/client";

import { ForbiddenError } from "./auth-errors";
import type { StoreContext } from "./store-context";

export type Permission =
  | "VIEW_STORE"
  | "SELL_MEDICINE"
  | "MANAGE_CATALOG"
  | "MANAGE_INVENTORY"
  | "MANAGE_FINANCE"
  | "MANAGE_USERS";

const ROLE_PERMISSIONS: Readonly<Record<MembershipRole, readonly Permission[]>> = {
  OWNER: ["VIEW_STORE", "SELL_MEDICINE", "MANAGE_CATALOG", "MANAGE_INVENTORY", "MANAGE_FINANCE", "MANAGE_USERS"],
  PHARMACIST: ["VIEW_STORE", "SELL_MEDICINE", "MANAGE_CATALOG"],
  CLINICIAN: ["VIEW_STORE", "MANAGE_CATALOG"],
  INVENTORY_STAFF: ["VIEW_STORE", "MANAGE_CATALOG", "MANAGE_INVENTORY"],
  ACCOUNTANT: ["VIEW_STORE", "MANAGE_FINANCE"],
  SYSTEM_ADMIN: ["VIEW_STORE", "SELL_MEDICINE", "MANAGE_CATALOG", "MANAGE_INVENTORY", "MANAGE_FINANCE", "MANAGE_USERS"],
};

export function can(role: MembershipRole, permission: Permission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function requirePermission(context: StoreContext, permission: Permission) {
  if (!can(context.role, permission)) {
    throw new ForbiddenError(`Role ${context.role} cannot perform ${permission}.`);
  }
  return context;
}

export function requireStoreAccess(context: StoreContext, resourceStoreId: string) {
  if (context.storeId !== resourceStoreId) {
    throw new ForbiddenError("The resource belongs to another store.");
  }
  return context;
}
