import { SystemRole, type MembershipRole } from "@/generated/prisma/client";

import { ForbiddenError } from "./auth-errors";
import type { LocalUser } from "./auth-context";
import type { StoreContext } from "./store-context";

export type Permission =
  | "VIEW_STORE"
  | "SELL_MEDICINE"
  | "MANAGE_CATALOG"
  | "MANAGE_INVENTORY"
  | "MANAGE_FINANCE"
  | "MANAGE_USERS";

export type SystemPermission =
  | "ACCESS_SYSTEM_ADMIN"
  | "MANAGE_GLOBAL_CATALOG"
  | "MANAGE_STORES"
  | "MANAGE_SYSTEM_USERS";

const ROLE_PERMISSIONS: Readonly<Record<MembershipRole, readonly Permission[]>> = {
  OWNER: ["VIEW_STORE", "SELL_MEDICINE", "MANAGE_CATALOG", "MANAGE_INVENTORY", "MANAGE_FINANCE", "MANAGE_USERS"],
  PHARMACIST: ["VIEW_STORE", "SELL_MEDICINE", "MANAGE_CATALOG"],
  CLINICIAN: ["VIEW_STORE", "MANAGE_CATALOG"],
  INVENTORY_STAFF: ["VIEW_STORE", "MANAGE_CATALOG", "MANAGE_INVENTORY"],
  ACCOUNTANT: ["VIEW_STORE", "MANAGE_FINANCE"],
};

const SYSTEM_ROLE_PERMISSIONS: Readonly<Record<SystemRole, readonly SystemPermission[]>> = {
  USER: [],
  SYSTEM_ADMIN: ["ACCESS_SYSTEM_ADMIN", "MANAGE_GLOBAL_CATALOG", "MANAGE_STORES", "MANAGE_SYSTEM_USERS"],
};

export function can(role: MembershipRole, permission: Permission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canSystem(role: SystemRole, permission: SystemPermission) {
  return SYSTEM_ROLE_PERMISSIONS[role].includes(permission);
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

export function requireSystemPermission(actor: LocalUser, permission: SystemPermission) {
  if (!canSystem(actor.systemRole, permission)) {
    throw new ForbiddenError(`System role ${actor.systemRole} cannot perform ${permission}.`);
  }
  return actor;
}

export function requireSystemAdmin(actor: LocalUser) {
  return requireSystemPermission(actor, "ACCESS_SYSTEM_ADMIN");
}
