import { redirect } from "next/navigation";

import { UnauthorizedError } from "@/modules/identity/application/auth-errors";
import { getCurrentWorkspaceState } from "@/modules/identity/infrastructure/current-store-context";

import { DashboardOverviewClient } from "./dashboard-overview-client";
import { StoreSelector } from "./store-selector";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let workspace;
  try {
    workspace = await getCurrentWorkspaceState();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/auth/login");
    throw error;
  }

  const activeStore = workspace.activeStore;
  if (!activeStore) {
    return <div className="page-stack"><div className="page-heading"><div><p className="eyebrow">Không gian làm việc</p><h1>Tổng quan vận hành</h1><p>Chọn nhà thuốc để bắt đầu làm việc.</p></div><span className="live-badge"><i /> Hôm nay</span></div>{workspace.memberships.length > 0 ? <StoreSelector stores={workspace.memberships} /> : <p className="notice notice-warning">Tài khoản chưa có nhà thuốc đang hoạt động.</p>}</div>;
  }

  return <DashboardOverviewClient storeName={activeStore.store.name} />;
}
