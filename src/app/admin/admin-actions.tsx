"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminLogoutButton() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function logout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      router.replace("/auth/login");
      router.refresh();
    }
  }

  return (
    <button className="button" disabled={isLoggingOut} onClick={logout} type="button">
      <LogOut size={15} /> {isLoggingOut ? "Đang đăng xuất…" : "Đăng xuất"}
    </button>
  );
}
