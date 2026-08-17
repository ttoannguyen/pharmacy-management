"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { resetTenantCatalogCache } from "@/modules/catalog/client/catalog-query";

type StoreOption = { storeId: string; store: { id: string; code: string; name: string }; role: string };

export function StoreSelector({ stores }: { stores: StoreOption[] }) {
  const [storeId, setStoreId] = useState(stores[0]?.storeId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  async function selectStore() {
    setIsSaving(true);
    setError(null);
    const response = await fetch("/api/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ storeId }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setError(result?.message ?? "Không thể chọn nhà thuốc.");
      setIsSaving(false);
      return;
    }
    resetTenantCatalogCache(queryClient);
    window.location.reload();
  }

  return (
    <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-[var(--border)]">
      <h2 className="text-lg font-semibold">Chọn nhà thuốc</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">Tài khoản của bạn có nhiều nhà thuốc. Chọn nơi đang làm việc.</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <select className="rounded-lg border border-[var(--border)] px-3 py-2" value={storeId} onChange={(event) => setStoreId(event.target.value)}>
          {stores.map((store) => <option key={store.storeId} value={store.storeId}>{store.store.name} ({store.role})</option>)}
        </select>
        <button className="rounded-lg bg-[var(--primary)] px-4 py-2 font-semibold text-white disabled:opacity-50" disabled={!storeId || isSaving} onClick={selectStore}>
          {isSaving ? "Đang lưu…" : "Chọn nhà thuốc"}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
