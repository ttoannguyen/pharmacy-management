import Link from "next/link";
import { redirect } from "next/navigation";

import { StoreSelectionRequiredError, UnauthorizedError } from "@/modules/identity/application/auth-errors";
import { loadCatalogPage } from "@/modules/catalog/presentation/catalog-read-model";

import { CatalogList } from "./catalog-list";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  let initialData;
  try {
    initialData = await loadCatalogPage("", { page: 1, pageSize: 20 });
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/auth/login");
    if (error instanceof StoreSelectionRequiredError) redirect("/dashboard");
    throw error;
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div><p className="eyebrow">Danh mục nhà thuốc</p><h1>Sản phẩm &amp; quy cách bán</h1><p>Quản lý tên hiển thị, SKU, đơn vị quy đổi và giá bán tại nhà thuốc.</p></div>
        <Link className="button button-primary" href="/dashboard/catalog/new">＋ Thêm sản phẩm</Link>
      </div>
      <CatalogList initialData={initialData} />
    </div>
  );
}
