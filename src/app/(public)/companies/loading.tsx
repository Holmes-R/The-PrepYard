export default function Loading() {
  return (
    <div
      className="company-sheet-theme"
      role="status"
      aria-label="Loading company questions"
    >
      <span className="sr-only">Loading company questions…</span>
      <div className="company-page-heading" aria-hidden="true">
        <p className="sheet-eyebrow">Company-wise practice</p>
        <div className="sheet-skeleton-lines">
          <span style={{ width: "42%", height: 34 }} />
          <span style={{ width: "64%", height: 12 }} />
        </div>
        <div className="company-directory-toolbar">
          <div className="company-search" aria-hidden="true" />
        </div>
      </div>
      <div className="company-grid" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="company-card">
            <div className="company-card-head">
              <span className="sheet-skeleton-tile" />
              <span className="sheet-skeleton-lines" style={{ flex: 1 }}>
                <span style={{ width: "70%", height: 14 }} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
