export default function DashboardLoading() {
  return (
    <div className="page-stack" aria-label="Đang tải không gian làm việc">
      <div className="skeleton-heading"><i /><i /><i /></div>
      <section className="metric-grid">
        {Array.from({ length: 4 }, (_, index) => <div className="metric-card skeleton-card" key={index}><i /><i /><i /></div>)}
      </section>
      <div className="panel skeleton-panel"><i /><i /><i /></div>
    </div>
  );
}
