"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { BarChart3, ClipboardList, LayoutDashboard, LogOut, Package, Pill, Settings, ShoppingCart, Warehouse } from "lucide-react";

import type { ReleaseInfo } from "@/lib/release-info";

import { DashboardWarmup } from "./dashboard-warmup";

type User = { displayName: string | null; email: string; systemRole: string };
type ActiveStore = { store: { id: string; code: string; name: string }; role: string } | null;

const navigation = [
  { label: "Tổng quan", href: "/dashboard", icon: LayoutDashboard, available: true },
  { label: "Danh mục thuốc", href: "/dashboard/catalog", icon: Pill, available: true },
  { label: "Bán hàng", href: "/dashboard/sales", icon: ShoppingCart, available: false },
  { label: "Nhập kho", href: "/dashboard/receipts", icon: ClipboardList, available: false },
  { label: "Tồn kho", href: "/dashboard/inventory", icon: Warehouse, available: false },
] as const;

const roleLabels: Record<string, string> = {
  OWNER: "Chủ nhà thuốc",
  PHARMACIST: "Dược sĩ",
  CLINICIAN: "Người khám",
  INVENTORY_STAFF: "Nhân viên kho",
  ACCOUNTANT: "Kế toán",
};

export function DashboardShell({ children, user, activeStore, release }: { children: React.ReactNode; user: User; activeStore: ActiveStore; release: ReleaseInfo }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const initial = (user.displayName ?? user.email).slice(0, 1).toUpperCase();

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      router.replace("/auth/login");
      router.refresh();
    }
  }

  return (
    <div className="app-shell">
      <DashboardWarmup enabled={Boolean(activeStore)} />
      <aside className="app-sidebar">
        <Link className="brand" href="/dashboard" aria-label="Pharmacy - Tổng quan"><span className="brand-mark">✚</span><span>Pharmacy</span></Link>
        <div className="store-pill"><span className="store-dot" /><span className="truncate"><strong>{activeStore?.store.name ?? "Chưa chọn nhà thuốc"}</strong><small>{activeStore?.store.code ?? "Chọn không gian làm việc"}</small></span></div>
        <nav className="sidebar-nav" aria-label="Điều hướng chính">
          <p className="sidebar-label">VẬN HÀNH</p>
          {navigation.map((item) => item.available ? (
            <Link className={`sidebar-link ${pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href)) ? "is-active" : ""}`} href={item.href} key={item.href} prefetch={item.href === "/dashboard"}><span className="sidebar-icon"><item.icon size={17} strokeWidth={1.8} /></span><span>{item.label}</span></Link>
          ) : (
            <span aria-disabled="true" className="sidebar-link is-disabled" key={item.href} title={`${item.label} đang được xây dựng`}><span className="sidebar-icon"><item.icon size={17} strokeWidth={1.8} /></span><span>{item.label}</span><small>Sắp có</small></span>
          ))}
          <p className="sidebar-label sidebar-label-spaced">PHÂN TÍCH</p>
          <span aria-disabled="true" className="sidebar-link is-disabled" title="Báo cáo cần dữ liệu bán hàng"><span className="sidebar-icon"><BarChart3 size={17} strokeWidth={1.8} /></span><span>Báo cáo</span><small>Sắp có</small></span>
          <p className="sidebar-label sidebar-label-spaced">HỆ THỐNG</p>
          {user.systemRole === "SYSTEM_ADMIN" ? <Link className="sidebar-link" href="/admin"><span className="sidebar-icon"><Settings size={17} strokeWidth={1.8} /></span><span>System Admin</span></Link> : null}
          <span aria-disabled="true" className="sidebar-link is-disabled"><span className="sidebar-icon"><Settings size={17} strokeWidth={1.8} /></span><span>Cài đặt</span><small>Sắp có</small></span>
        </nav>
        <div className="sidebar-bottom">
          <a className="release-badge" href="/api/health" rel="noreferrer" target="_blank" title={`Active release ${release.activeVersion} · ${release.branch}`}><span />v{release.activeVersion}</a>
          <div className="user-card"><span className="avatar">{initial}</span><span className="user-meta"><strong>{user.displayName ?? roleLabels[activeStore?.role ?? ""] ?? "Người dùng"}</strong><small>{user.email}</small></span><button aria-label="Đăng xuất" disabled={loggingOut} onClick={logout} title="Đăng xuất"><LogOut size={16} /></button></div>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <div className="breadcrumb"><span className="mobile-brand">✚ Pharmacy</span><span className="topbar-context">{activeStore?.store.name ?? "Không gian làm việc"} <i>/</i> {pathname.includes("catalog") ? "Danh mục" : "Tổng quan"}</span></div>
          <div className="topbar-actions"><span className="system-status"><i /> Hệ thống sẵn sàng</span><span className="role-chip">{roleLabels[activeStore?.role ?? ""] ?? "Chưa chọn vai trò"}</span><span className="topbar-avatar">{initial}</span></div>
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
