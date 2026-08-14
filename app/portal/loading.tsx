export default function PortalLoading() {
  return (
    <div className="page-shell" style={{ minHeight: "100dvh" }}>
      <div className="shell-panel" style={{ paddingTop: "2.5rem", paddingBottom: "2.5rem" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Header skeleton */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div className="skeleton skeleton-avatar" />
            <div style={{ flex: 1 }}>
              <div className="skeleton skeleton-line medium" />
              <div className="skeleton skeleton-line short" />
            </div>
          </div>

          {/* Metrics skeleton */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem" }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton skeleton-card">
                <div className="skeleton skeleton-line short" />
                <div className="skeleton skeleton-line medium" />
              </div>
            ))}
          </div>

          {/* Content skeleton */}
          <div className="skeleton skeleton-card">
            <div className="skeleton skeleton-line full" />
            <div className="skeleton skeleton-line full" />
            <div className="skeleton skeleton-line medium" />
          </div>

          <div className="skeleton skeleton-card">
            <div className="skeleton skeleton-line short" />
            <div className="skeleton skeleton-line full" />
            <div className="skeleton skeleton-line full" />
            <div className="skeleton skeleton-line medium" />
          </div>
        </div>
      </div>
    </div>
  );
}
