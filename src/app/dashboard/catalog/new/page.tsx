import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { StoreSelectionRequiredError, UnauthorizedError } from "@/modules/identity/application/auth-errors";
import { getCurrentStoreContext } from "@/modules/identity/infrastructure/current-store-context";

import { QuickCreateProductForm } from "./quick-create-form";

export const dynamic = "force-dynamic";

export default async function NewCatalogProductPage() {
  let units;
  try {
    [, units] = await Promise.all([
      getCurrentStoreContext(),
      prisma.unit.findMany({ orderBy: { name: "asc" }, select: { id: true, code: true, name: true } }),
    ]);
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/auth/login");
    if (error instanceof StoreSelectionRequiredError) redirect("/dashboard");
    throw error;
  }

  return (
    <div className="page-stack page-narrow">
      <Link className="back-link" href="/dashboard/catalog">← Quay lại danh mục</Link>
      <div className="page-heading"><div><p className="eyebrow">Sản phẩm mới</p><h1>Thêm vào danh mục nhà thuốc</h1><p>Tạo thông tin bán hàng local. Dữ liệu này không thay đổi danh mục thuốc dùng chung.</p></div></div>
      <QuickCreateProductForm units={units} />
    </div>
  );
}
