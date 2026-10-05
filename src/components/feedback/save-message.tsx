"use client";
import { useEffect, useState } from "react";
// A success confirmation that dismisses itself. Remount (via key) to re-announce:
// a persistent "Saved" reads as stuck, and a live region that never changes is
// never re-announced. Errors use role="alert" elsewhere and are never transient.
export function SaveMessage({
  text = "Saved",
  className,
}: {
  text?: string;
  className?: string;
}) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 2500);
    return () => clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return (
    <p role="status" className={className}>
      {text}
    </p>
  );
}
