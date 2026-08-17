import Link from "next/link";

import { SystemRole } from "@/generated/prisma/client";
import { getCurrentActor } from "@/modules/identity/infrastructure/current-store-context";

const modules = [
  { name: "Danh mục thuốc", detail: "Dữ liệu chung, dữ liệu nhà thuốc và barcode" },
  { name: "Nhập kho", detail: "Theo lô, hạn dùng, giá nhập và nhà cung cấp" },
  { name: "Bán hàng", detail: "Quét mã, FEFO, thanh toán và trả hàng" },
  { name: "Báo cáo", detail: "Doanh thu, giá vốn và lợi nhuận gộp" },
];

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const currentUser = await getCurrentActor();
  const workspaceHref = currentUser?.systemRole === SystemRole.SYSTEM_ADMIN ? "/admin" : "/dashboard";

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10 sm:px-8">
      <header className="rounded-3xl bg-[var(--surface)] p-7 shadow-sm ring-1 ring-[var(--border)] sm:p-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <span className="text-sm font-bold tracking-tight">Pharmacy Management</span>
          {currentUser ? (
            <Link className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]" href={workspaceHref}>
              {currentUser.systemRole === SystemRole.SYSTEM_ADMIN ? "Vào System Admin" : "Vào dashboard"}
            </Link>
          ) : (
            <Link className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]" href="/auth/login">
              Đăng nhập
            </Link>
          )}
        </div>
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
          Pharmacy Management
        </p>
        <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
          Quản lý đúng từng lô thuốc, từ nhập kho đến lợi nhuận.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
          Nền tảng đang ở Milestone 0. Kiến trúc tenant, catalog dùng chung và dữ liệu
          riêng của nhà thuốc đã được định nghĩa để triển khai vertical slice đầu tiên.
        </p>
      </header>

      <section className="mt-7 grid gap-4 sm:grid-cols-2" aria-label="Các phân hệ">
        {modules.map((module) => (
          <article
            className="rounded-2xl bg-[var(--surface)] p-6 ring-1 ring-[var(--border)]"
            key={module.name}
          >
            <h2 className="text-lg font-semibold">{module.name}</h2>
            <p className="mt-2 leading-6 text-[var(--muted)]">{module.detail}</p>
          </article>
        ))}
      </section>
      <Link className="mt-7 inline-block rounded-lg bg-[var(--primary)] px-5 py-3 font-semibold text-white" href={currentUser ? workspaceHref : "/auth/login"}>
        {currentUser ? "Mở không gian làm việc" : "Đăng nhập hệ thống"}
      </Link>
      {currentUser ? <p className="mt-3 text-sm text-[var(--muted)]">Xin chào {currentUser.displayName}.</p> : null}
    </main>
  );
}
