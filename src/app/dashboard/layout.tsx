import { redirect } from "next/navigation";

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

  const activeStore = workspace.activeStore
    ? { store: workspace.activeStore.store, role: workspace.activeStore.role }
    : null;

  return <AppProviders storeScope={activeStore?.store.id}><DashboardShell user={workspace.actor} activeStore={activeStore}>{children}</DashboardShell></AppProviders>;
}
