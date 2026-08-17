"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ email, password }) });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      setErrorMessage(result?.message ?? "Đăng nhập thất bại.");
      setIsSubmitting(false);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
      <label className="block text-sm font-medium" htmlFor="email">Email<input autoComplete="email" className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 outline-none focus:border-[var(--primary)]" id="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
      <label className="block text-sm font-medium" htmlFor="password">Mật khẩu<input autoComplete="current-password" className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 outline-none focus:border-[var(--primary)]" id="password" minLength={12} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
      {errorMessage ? <p className="text-sm text-red-700">{errorMessage}</p> : null}
      <button className="w-full rounded-lg bg-[var(--primary)] px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={isSubmitting} type="submit">{isSubmitting ? "Đang đăng nhập…" : "Đăng nhập"}</button>
    </form>
  );
}
