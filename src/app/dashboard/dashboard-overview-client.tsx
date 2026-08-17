"use client";

import Link from "next/link";

import { useCatalogOverview } from "@/modules/catalog/client/catalog-query";

const numberFormatter = new Intl.NumberFormat("vi-VN");
const dateFormatter = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" });

export function DashboardOverviewClient({ storeName }: { storeName: string }) {
  const overview = useCatalogOverview();

  return (
    <div className="page-stack">
      <PageHeading storeName={storeName} />
      {overview.isError ? <div className="notice notice-error"><strong>Không tải được tổng quan.</strong><span>{overview.error.message}</span><button className="text-link" onClick={() => overview.refetch()}>Thử lại</button></div> : null}
      <section className="metric-grid" aria-label="Tổng quan danh mục">
        {overview.data ? [
          { label: "Sản phẩm đang bán", value: overview.data.productCount, detail: "Trong danh mục nhà thuốc", tone: "blue" },
          { label: "Quy cách / SKU", value: overview.data.skuCount, detail: "Đơn vị bán đã cấu hình", tone: "violet" },
          { label: "SKU đã có giá", value: overview.data.pricedSkuCount, detail: `${overview.data.skuCount ? Math.round((overview.data.pricedSkuCount / overview.data.skuCount) * 100) : 0}% sẵn sàng bán`, tone: "green" },
          { label: "SKU có mã nhận diện", value: overview.data.identifiedSkuCount, detail: "Thuận tiện khi tra cứu", tone: "amber" },
        ].map((stat) => (
          <article className={`metric-card metric-${stat.tone}`} key={stat.label}>
            <div className="metric-icon" aria-hidden="true" />
            <p>{stat.label}</p>
            <strong>{numberFormatter.format(stat.value)}</strong>
            <small>{stat.detail}</small>
          </article>
        )) : <MetricSkeleton />}
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Cập nhật gần đây</p><h2>Danh mục thuốc</h2></div>
            <Link className="text-link" href="/dashboard/catalog">Xem tất cả</Link>
          </div>
          {overview.data?.recentProducts.length ? (
            <div className="activity-list">
              {overview.data.recentProducts.map((product) => (
                <div className="activity-row" key={product.id}>
                  <span className="product-monogram">{product.displayName.slice(0, 1).toUpperCase()}</span>
                  <span className="activity-copy"><strong>{product.displayName}</strong><small>{product.skuCount} SKU</small></span>
                  <time dateTime={product.updatedAt}>{dateFormatter.format(new Date(product.updatedAt))}</time>
                </div>
              ))}
            </div>
          ) : overview.data ? (
            <div className="empty-inline"><p>Chưa có sản phẩm nào trong danh mục.</p><Link className="button button-primary" href="/dashboard/catalog/new">Thêm sản phẩm đầu tiên</Link></div>
          ) : <div className="activity-list" aria-label="Đang tải cập nhật"><div className="skeleton-row" /><div className="skeleton-row" /><div className="skeleton-row" /></div>}
        </article>

        <aside className="panel action-panel">
          <p className="eyebrow">Thao tác nhanh</p>
          <h2>Tiếp tục công việc</h2>
          <p className="panel-description">Hoàn thiện danh mục trước khi triển khai tồn kho theo lô và bán hàng FEFO.</p>
          <div className="action-list">
            <Link className="action-link action-primary" href="/dashboard/catalog/new"><span>＋</span><span><strong>Thêm sản phẩm</strong><small>Tạo thuốc và SKU bán</small></span></Link>
            <Link className="action-link" href="/dashboard/catalog"><span>⌕</span><span><strong>Tra cứu danh mục</strong><small>Tìm theo tên, SKU hoặc mã</small></span></Link>
          </div>
          <div className="roadmap-note"><span>Đang xây dựng</span><p>Nhập kho theo lô là bước nghiệp vụ tiếp theo; chưa hiển thị số tồn giả khi ledger chưa tồn tại.</p></div>
        </aside>
      </section>
    </div>
  );
}

function MetricSkeleton() {
  return <>{Array.from({ length: 4 }, (_, index) => <article className="metric-card" key={index} aria-hidden="true"><div className="metric-icon" /><p className="skeleton-line" /><strong className="skeleton-line" /><small className="skeleton-line" /></article>)}</>;
}

function PageHeading({ storeName }: { storeName: string }) {
  return <div className="page-heading"><div><p className="eyebrow">Không gian làm việc</p><h1>Tổng quan vận hành</h1><p>Dữ liệu hiện có của {storeName}.</p></div><span className="live-badge"><i /> Hôm nay</span></div>;
}
