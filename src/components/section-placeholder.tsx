import Link from "next/link";
import { ArrowLeft, Construction } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SectionPlaceholder({
  title,
  description,
  detail,
}: {
  title: string;
  description: string;
  detail: string;
}) {
  return (
    <section className="mx-auto max-w-3xl py-8">
      <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-primary">
        Your preparation space
      </p>
      <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
      <p className="mt-4 text-xl text-muted-foreground">{description}</p>
      <div className="my-8 rounded-2xl border bg-card p-7">
        <Construction aria-hidden="true" className="mb-4 text-primary" />
        <h2 className="font-semibold">Coming in a future milestone</h2>
        <p className="mt-3 leading-7 text-muted-foreground">{detail}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          Browse company questions or practice sheets to keep preparing.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/">
          <ArrowLeft size={16} aria-hidden="true" /> Back to home
        </Link>
      </Button>
    </section>
  );
}
