import type { User } from "@/generated/prisma/client";

import { UnauthorizedError } from "@/modules/identity/application/auth-errors";

export { UnauthorizedError } from "@/modules/identity/application/auth-errors";

export type LocalUser = Pick<
  User,
  "id" | "email" | "displayName" | "isActive" | "emailVerifiedAt" | "systemRole"
>;

export interface CurrentUserReader {
  readCurrentUser(): Promise<LocalUser | null>;
}

export async function requireLocalUser(reader: CurrentUserReader): Promise<LocalUser> {
  const user = await reader.readCurrentUser();

  if (!user || !user.isActive) {
    throw new UnauthorizedError();
  }

  return user;
}
