import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Building2, Layers3, Code2 } from "lucide-react";
import { prepYardCollections } from "@/features/patterns/collections.mjs";
export const metadata: Metadata = { title: "Explore" };
const sheets = prepYardCollections.map((c) => [c.slug, c.name, c.description]);
export default function Page() {
  return (
    <>
      <header className="launch-page-heading">
        <span className="launch-eyebrow">YOUR PRACTICE LIBRARY</span>
        <h1>Find your next challenge.</h1>
        <p>
          Choose a direction. Every question keeps the same progress and private
          notes across collections.
        </p>
      </header>
      <div className="launch-library">
        <Link className="launch-feature" href="/companies">
          <div className="feature-icon">
            <Building2 />
          </div>
          <h2>Company questions</h2>
          <p>Prepare for your target company, sorted by reported frequency.</p>
          <span className="feature-link">
            Explore companies <ArrowUpRight size={16} />
          </span>
        </Link>
        <Link className="launch-feature" href="/patterns">
          <div className="feature-icon">
            <Layers3 />
          </div>
          <h2>All DSA topics</h2>
          <p>
            Practice by standard topic and filter by the patterns you want to
            understand.
          </p>
          <span className="feature-link">
            Browse topics <ArrowUpRight size={16} />
          </span>
        </Link>
        {sheets.map(([slug, title, text]) => (
          <Link
            className="launch-feature"
            key={slug}
            href={"/patterns?collection=" + slug}
          >
            <div className="feature-icon">
              <Code2 />
            </div>
            <h2>{title}</h2>
            <p>{text}</p>
            <span className="feature-link">
              Open sheet <ArrowUpRight size={16} />
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
