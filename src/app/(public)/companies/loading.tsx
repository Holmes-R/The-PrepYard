export default function Loading() {
  return (
    <div role="status" className="mx-auto max-w-6xl p-8">
      <p className="text-muted-foreground">Loading company questions…</p>
      <div
        aria-hidden
        className="mt-6 h-48 animate-pulse rounded-3xl bg-muted"
      />
    </div>
  );
}
