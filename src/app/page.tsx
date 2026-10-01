import Link from "next/link";
import { ArrowRight, BookOpen, Building2, Layers3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { site } from "@/lib/site";

const paths = [
  {
    href: "/companies",
    title: "Pick your company",
    text: "A focused path towards your next interview.",
    icon: Building2,
  },
  {
    href: "/patterns",
    title: "Understand the pattern",
    text: "Build the ideas that connect the problems.",
    icon: Layers3,
  },
  {
    href: "/explore",
    title: "Find your next question",
    text: "Make space for practice across platforms.",
    icon: BookOpen,
  },
];

export default function Home() {
  return (
    <>
      <section className="grid gap-10 py-8 md:grid-cols-[1.4fr_1fr] md:py-16">
        <div>
          <p className="mb-6 text-sm font-bold uppercase tracking-[0.18em] text-primary">
            A little practice. A lot of possibility.
          </p>
          <h1 className="max-w-2xl text-5xl leading-[1.08] font-bold tracking-tight md:text-6xl">
            Your next chapter
            <br />
            starts in the yard.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
            A free home for company-wise coding preparation, patterns, and
            steady progress. Built for students, across platforms.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/explore">
                Explore the workspace{" "}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/about">Our mission</Link>
            </Button>
          </div>
        </div>
        <aside className="self-center rounded-3xl border bg-card p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Growing from the ground up
          </p>
          <h2 className="mt-4 text-2xl font-semibold">
            The foundation is ready.
          </h2>
          <p className="mt-4 leading-7 text-muted-foreground">
            This first milestone establishes the application. Live question
            imports, personal progress, and account sync are next.
          </p>
          <a
            href={site.repository}
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary"
          >
            Follow the project on GitHub{" "}
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </aside>
      </section>
      <section
        aria-label="Ways to prepare"
        className="grid gap-5 pb-10 md:grid-cols-3"
      >
        {paths.map(({ href, title, text, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="rounded-2xl border bg-card p-7 transition-colors hover:border-primary"
          >
            <Icon aria-hidden="true" className="mb-6 text-primary" />
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-3 leading-7 text-muted-foreground">{text}</p>
          </Link>
        ))}
      </section>
    </>
  );
}
