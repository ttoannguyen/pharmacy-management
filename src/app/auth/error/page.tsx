import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-6">
      <section className="w-full rounded-2xl bg-white p-8 shadow-sm ring-1 ring-[var(--border)]">
        <p className="text-sm font-semibold uppercase tracking-wide text-red-700">Đăng nhập thất bại</p>
        <h1 className="mt-2 text-2xl font-bold">Không thể hoàn tất phiên đăng nhập</h1>
        <p className="mt-3 text-[var(--muted)]">Vui lòng thử lại hoặc liên hệ quản trị hệ thống.</p>
        <Link className="mt-6 inline-block text-[var(--primary)] underline" href="/">
          Quay về trang chủ
        </Link>
      </section>
    </main>
  );
}
