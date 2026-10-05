export default function Loading() {
  return (
    <section
      className="dsa-sheet"
      role="status"
      aria-label="Loading your topics and progress"
    >
      <span className="sr-only">Loading your topics and progress…</span>
      <div aria-hidden="true">
        <div
          className="dsa-skeleton-lines"
          style={{ gap: 12, marginBottom: 28 }}
        >
          <span style={{ width: "38%", height: 40 }} />
          <span style={{ width: "55%", height: 14 }} />
        </div>
        <div className="dsa-skeleton">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="dsa-skeleton-row">
              <span className="dsa-skeleton-dot" />
              <span className="dsa-skeleton-lines">
                <span />
                <span />
              </span>
              <span className="dsa-skeleton-chip" />
              <span className="dsa-skeleton-dot" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
