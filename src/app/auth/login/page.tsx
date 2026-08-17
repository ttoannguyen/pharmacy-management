import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/app/auth/login/login-form";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/modules/identity/application/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser(prisma)) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <section className="w-full rounded-2xl bg-white p-8 shadow-sm ring-1 ring-[var(--border)]">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--primary)]">Pharmacy Management</p>
        <h1 className="mt-2 text-2xl font-bold">Đăng nhập</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Sử dụng tài khoản được quản trị hệ thống cấp.</p>
        <LoginForm />
        <Link className="mt-5 inline-block text-sm text-[var(--primary)] underline" href="/">Quay về trang chủ</Link>
      </section>
    </main>
  );
}
