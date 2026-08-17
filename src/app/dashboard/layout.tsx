import { redirect } from "next/navigation";

import { SystemRole } from "@/generated/prisma/client";
import { UnauthorizedError } from "@/modules/identity/application/auth-errors";
import { getCurrentWorkspaceState } from "@/modules/identity/infrastructure/current-store-context";

import { DashboardShell } from "./dashboard-shell";
import { AppProviders } from "../providers";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let workspace;
  try {
    workspace = await getCurrentWorkspaceState();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/auth/login");
    throw error;
  }

  if (!workspace.actor) redirect("/auth/login");
  if (workspace.actor.systemRole === SystemRole.SYSTEM_ADMIN && workspace.memberships.length === 0) redirect("/admin");

  const activeStore = workspace.activeStore
    ? {
      store: {
        id: workspace.activeStore.store.id,
        code: workspace.activeStore.store.code,
        name: workspace.activeStore.store.name,
      },
      role: workspace.activeStore.role,
    }
    : null;
  const memberships = workspace.memberships.map((membership) => ({
    storeId: membership.storeId,
    role: membership.role,
    store: {
      id: membership.store.id,
      code: membership.store.code,
      name: membership.store.name,
    },
  }));

  return <AppProviders workspace={{ activeStore, memberships }}><DashboardShell user={workspace.actor} activeStore={activeStore}>{children}</DashboardShell></AppProviders>;
}
