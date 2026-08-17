import Link from "next/link";
import { redirect, notFound } from "next/navigation";

import { StoreSelectionRequiredError, UnauthorizedError } from "@/modules/identity/application/auth-errors";
import { loadCatalogProductDetail } from "@/modules/catalog/presentation/catalog-detail-read-model";
import { prisma } from "@/lib/prisma";

import { ProductDetailClient } from "./product-detail-client";

export const dynamic = "force-dynamic";

export default async function CatalogProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let result;
  try {
    result = await loadCatalogProductDetail(id);
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/auth/login");
    if (error instanceof StoreSelectionRequiredError) redirect("/dashboard");
    throw error;
  }
  if (!result.detail) notFound();
  const units = await prisma.unit.findMany({ orderBy: { name: "asc" }, select: { id: true, code: true, name: true } });

  return (
    <div className="page-stack">
      <div className="detail-breadcrumb"><Link href="/dashboard/catalog">Danh mục thuốc</Link><span>/</span><span>{result.detail.displayName}</span></div>
      <ProductDetailClient productId={id} initialData={result.detail} units={units} />
    </div>
  );
}
