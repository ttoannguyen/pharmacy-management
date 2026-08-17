"use client";

import { useDashboardWorkspace } from "@/app/providers";

import { DashboardOverviewClient } from "./dashboard-overview-client";
import { StoreSelector } from "./store-selector";

export function DashboardHomeClient() {
  const workspace = useDashboardWorkspace();

  if (workspace.activeStore) {
    return <DashboardOverviewClient storeName={workspace.activeStore.store.name} />;
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div><p className="eyebrow">Không gian làm việc</p><h1>Tổng quan vận hành</h1><p>Chọn nhà thuốc để bắt đầu làm việc.</p></div>
        <span className="live-badge"><i /> Hôm nay</span>
      </div>
      {workspace.memberships.length > 0
        ? <StoreSelector stores={workspace.memberships} />
        : <p className="notice notice-warning">Tài khoản chưa có nhà thuốc đang hoạt động.</p>}
    </div>
  );
}
