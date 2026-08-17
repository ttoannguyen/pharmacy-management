"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import {
  storeProductDetailQueryOptions,
  storeProductsQueryOptions,
  type StoreProductList,
  useStoreProducts,
} from "@/modules/catalog/client/catalog-query";
import { useStoreScope } from "@/app/providers";

const moneyFormatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const numberFormatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 6 });

export function CatalogList({ initialData }: { initialData: StoreProductList }) {
  const queryClient = useQueryClient();
  const scope = useStoreScope();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const products = useStoreProducts(query, page, query === "" && page === 1 ? initialData : undefined);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(1);
      setQuery(input.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [input]);

  useEffect(() => {
    if (!products.data?.hasNextPage || products.isPlaceholderData) return;
    const nextPage = page + 1;
    void queryClient.prefetchQuery(storeProductsQueryOptions(query, nextPage, scope));
  }, [page, products.data?.hasNextPage, products.isPlaceholderData, query, queryClient, scope]);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setQuery(input.trim());
  }

  const start = products.data?.items.length ? (page - 1) * products.data.pageSize + 1 : 0;
  const end = products.data ? start + products.data.items.length - 1 : 0;

  return (
    <section className="catalog-panel">
      <div className="catalog-toolbar">
        <form className="search-box" onSubmit={submitSearch} role="search">
          <span aria-hidden="true">⌕</span>
          <input aria-label="Tìm sản phẩm" autoComplete="off" placeholder="Tìm theo tên thuốc, SKU hoặc mã nhận diện" value={input} onChange={(event) => setInput(event.target.value)} />
          {input ? <button aria-label="Xóa tìm kiếm" className="clear-search" onClick={() => setInput("")} type="button">×</button> : null}
        </form>
        <span className="result-count">{products.data?.total !== null && products.data?.total !== undefined ? `${numberFormatter.format(products.data.total)} sản phẩm` : `Trang ${page}`}</span>
      </div>

      {products.isError ? <div className="notice notice-error"><strong>Không tải được danh mục.</strong><span>{products.error.message}</span><button className="text-link" onClick={() => products.refetch()}>Thử lại</button></div> : null}

      {products.isLoading ? <CatalogSkeleton /> : null}

      {products.data?.items.length ? (
        <div className={`product-list ${products.isFetching ? "is-refreshing" : ""}`} aria-live="polite">
          {products.data.items.map((product) => (
            <article className="product-row" key={product.id}>
              <span className="product-monogram">{product.displayName.slice(0, 1).toUpperCase()}</span>
              <div className="product-main">
                <div className="product-title"><h2><Link href={`/dashboard/catalog/${product.id}`} onMouseEnter={() => { void queryClient.prefetchQuery(storeProductDetailQueryOptions(product.id, scope)); }}>{product.displayName}</Link></h2>{product.shelfLocation ? <span>Kệ {product.shelfLocation}</span> : null}</div>
                <p>Đơn vị cơ sở: {product.baseUnit.name}</p>
              </div>
              <div className="sku-list">
                {product.skus.map((sku) => (
                  <div className="sku-row" key={sku.id}>
                    <span><strong>{sku.code}</strong><small>{sku.unit.name} = {numberFormatter.format(Number(sku.quantityInBaseUnit))} {product.baseUnit.name.toLowerCase()}</small></span>
                    <span className="sku-code">{sku.barcodes[0] ?? "Chưa có mã"}</span>
                    <strong className="sku-price">{moneyFormatter.format(Number(sku.sellingPriceMinor))}</strong>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {products.data?.items.length === 0 && !products.isFetching ? (
        <div className="empty-state"><span aria-hidden="true">⌕</span><h2>{query ? "Không tìm thấy sản phẩm" : "Danh mục đang trống"}</h2><p>{query ? `Không có kết quả phù hợp với “${query}”. Hãy thử tên hoặc mã khác.` : "Thêm sản phẩm đầu tiên để cấu hình SKU và giá bán."}</p>{query ? <button className="button" onClick={() => setInput("")}>Xóa bộ lọc</button> : <Link className="button button-primary" href="/dashboard/catalog/new">Thêm sản phẩm</Link>}</div>
      ) : null}

      {products.data && (page > 1 || products.data.hasNextPage) ? (
        <div className="pagination"><span>Hiển thị {start}–{end}{products.data.total !== null ? ` / ${products.data.total}` : ""}</span><div><button disabled={page === 1 || products.isFetching} onClick={() => setPage((value) => Math.max(1, value - 1))}>← Trước</button><button disabled={!products.data.hasNextPage || products.isFetching} onClick={() => setPage((value) => value + 1)}>Sau →</button></div></div>
      ) : null}
    </section>
  );
}

function CatalogSkeleton() {
  return <div className="product-list" aria-label="Đang tải danh mục">{Array.from({ length: 4 }, (_, index) => <div className="skeleton-row" key={index}><i /><span><i /><i /></span></div>)}</div>;
}
