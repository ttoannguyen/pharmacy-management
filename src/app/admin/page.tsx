import { Building2, ClipboardCheck, Pill, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { ForbiddenError, UnauthorizedError } from "@/modules/identity/application/auth-errors";
import { getSystemAdminOverview } from "@/modules/identity/application/system-admin";
import { getCurrentWorkspaceState } from "@/modules/identity/infrastructure/current-store-context";
import { PrismaSystemAdminOverviewRepository } from "@/modules/identity/infrastructure/prisma-system-admin-overview";

import { AdminLogoutButton } from "./admin-actions";

export const dynamic = "force-dynamic";

export default async function SystemAdminPage() {
  let workspace;
  try {
    workspace = await getCurrentWorkspaceState();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/auth/login");
    throw error;
  }

  const actor = workspace.actor;
  if (!actor) redirect("/auth/login");

  let overview;
  try {
    overview = await getSystemAdminOverview(actor, new PrismaSystemAdminOverviewRepository(prisma));
  } catch (error) {
    if (error instanceof ForbiddenError) redirect("/dashboard");
    throw error;
  }

  const metrics = [
    { label: "Người dùng hoạt động", value: overview.activeUsers, icon: Users, tone: "metric-blue" },
    { label: "Nhà thuốc hoạt động", value: overview.activeStores, icon: Building2, tone: "metric-green" },
    { label: "Thuốc đăng ký", value: overview.registeredProducts, icon: Pill, tone: "metric-violet" },
    { label: "Đề xuất chờ duyệt", value: overview.pendingCatalogSubmissions, icon: ClipboardCheck, tone: "metric-amber" },
  ];

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 sm:px-8">
      <header className="flex flex-col gap-5 rounded-2xl bg-white p-6 ring-1 ring-[var(--border)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--soft-blue)] text-[var(--primary)]"><ShieldCheck size={23} /></span>
          <div><p className="eyebrow">Quản trị toàn hệ thống</p><h1 className="mt-1 text-2xl font-bold tracking-tight">System Admin</h1><p className="mt-1 text-sm text-[var(--muted)]">{actor.displayName ?? actor.email}</p></div>
        </div>
        <div className="flex gap-2">{workspace.memberships.length > 0 ? <Link className="button" href="/dashboard">Không gian nhà thuốc</Link> : null}<AdminLogoutButton /></div>
      </header>

      <section className="metric-grid mt-6" aria-label="Tổng quan toàn hệ thống">
        {metrics.map(({ label, value, icon: Icon, tone }) => <article className={`metric-card ${tone}`} key={label}><Icon size={20} /><p>{label}</p><strong>{value.toLocaleString("vi-VN")}</strong><small>Dữ liệu toàn nền tảng</small></article>)}
      </section>

      <section className="panel mt-6">
        <p className="eyebrow">Ranh giới quyền</p>
        <h2>Quyền hệ thống tách khỏi quyền nhà thuốc</h2>
        <p className="panel-description">System Admin quản lý tài khoản, nhà thuốc và danh mục chung. Quyền thao tác vận hành trong một nhà thuốc vẫn cần membership rõ ràng để giữ tenant isolation và audit.</p>
      </section>
    </main>
  );
}
