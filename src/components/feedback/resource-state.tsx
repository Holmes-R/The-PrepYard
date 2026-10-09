"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function ResourceState({
  title,
  error,
  status,
  retry,
}: {
  title: string;
  error: string;
  status: number;
  retry: () => void;
}) {
  return (
    <section className="prep-resource-state" aria-busy={!error}>
      <h1>{title}</h1>
      {error ? (
        <>
          <p role="alert">{error}</p>
          <div className="prep-resource-actions">
            {status !== 404 && (
              <Button variant="secondary" onClick={retry}>
                Try again
              </Button>
            )}
            <Button asChild variant="ghost">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        </>
      ) : (
        <>
          <p role="status">Loading your workspace…</p>
          <div className="prep-resource-skeleton" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
        </>
      )}
    </section>
  );
}
