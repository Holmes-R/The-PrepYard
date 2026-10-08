"use client";
import { QuestionFilters } from "@/components/questions/question-filters";
import { QuestionHeader } from "@/components/questions/question-header";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Layers3 } from "lucide-react";
import { Question } from "./pattern-sheet";
import { patternHref } from "@/features/patterns/navigation.mjs";
import type {
  Choice,
  PatternFilters,
  PatternRows,
} from "@/features/patterns/queries.mjs";
export function PatternDetail({
  pattern,
  filters,
  rows,
  topics,
}: {
  topics: (Choice & { total: number })[];
  pattern: Choice;
  filters: PatternFilters;
  rows: PatternRows;
}) {
  const router = useRouter();
  const action = patternHref(pattern.slug);
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...filters, page }))
      if (value && key !== "pattern") params.set(key, String(value));
    return patternHref(pattern.slug, params);
  };
  return (
    <section className="dsa-sheet prep-pattern-detail">
      <Link href="/patterns" className="prep-pattern-back">
        <ArrowLeft size={16} aria-hidden="true" />
        All topics and patterns
      </Link>
      <header className="dsa-hero">
        <div>
          <p className="dsa-eyebrow">
            <Layers3 size={17} aria-hidden="true" />
            Pattern practice
          </p>
          <h1>{pattern.name}</h1>
          <p className="dsa-description">
            Practice this pattern across topics. Your notes and revision choices
            stay with each question.
          </p>
        </div>
        <div className="dsa-progress-card">
          <span>Your progress</span>
          <strong>
            {rows.solved}
            <small> / {rows.total}</small>
          </strong>
          <p>
            {rows.total ? Math.round((100 * rows.solved) / rows.total) : 0}%
            complete
          </p>
        </div>
      </header>
      <QuestionFilters
        q={filters.q}
        difficulty={filters.difficulty}
        progress={filters.progress}
        topics={topics.map((t) => ({ ...t, count: t.total }))}
        selectedTopics={filters.topic ? [filters.topic] : []}
        progressOptions={[
          { slug: "", name: "Any progress" },
          { slug: "unsolved", name: "Unsolved" },
          { slug: "solved", name: "Solved" },
          { slug: "bookmarked", name: "Bookmarked" },
        ]}
        action={action}
        resetHref={action}
        sort={filters.sort}
        order={filters.order}
        sortSelect
      >
        {filters.collection && (
          <input type="hidden" name="collection" value={filters.collection} />
        )}
        <label className="prep-filter-field">
          <span>Default order</span>
          <select
            name="sort"
            aria-label="Default order"
            defaultValue={filters.sort}
          >
            <option value="recommended">Recommended</option>
            <option value="difficulty-asc">Difficulty: Easy to Hard</option>
            <option value="difficulty-desc">Difficulty: Hard to Easy</option>
            <option value="revision">Revision priority</option>
            <option value="random">Shuffle</option>
          </select>
        </label>
        <label className="prep-filter-field prep-filter-check">
          <input
            type="checkbox"
            name="hideTopics"
            value="1"
            defaultChecked={filters.hideTopics === "1"}
          />
          <span>Hide topics in rows</span>
        </label>
      </QuestionFilters>
      {filters.sort === "revision" && (
        <p className="dsa-description">
          Due revisions first, then questions you struggled with, upcoming
          revisions, and unreviewed questions.
        </p>
      )}
      <div className="dsa-results-heading">
        <h2>{rows.total.toLocaleString()} questions</h2>
        <span>{rows.solved} solved</span>
      </div>
      <QuestionHeader
        hideTopics={filters.hideTopics === "1"}
        sort={filters.sort}
        order={filters.order}
        onChange={(order) => {
          const params = new URLSearchParams();
          for (const [key, value] of Object.entries({
            ...filters,
            order,
            page: 1,
          }))
            if (value && key !== "pattern") params.set(key, String(value));
          router.push(patternHref(pattern.slug, params));
        }}
      />
      <div className="prep-pattern-questions">
        {rows.rows.map((q) => (
          <Question
            key={q.id}
            question={q}
            filters={filters}
            onSaved={async () => {
              router.refresh();
            }}
          />
        ))}
      </div>
      {!rows.total && (
        <div className="dsa-empty">
          <h2>No matching questions</h2>
          <Link href={action}>Reset filters</Link>
        </div>
      )}
      {rows.pages > 1 && (
        <nav className="dsa-pagination" aria-label="Pattern question pages">
          {rows.page > 1 ? (
            <Link href={pageHref(rows.page - 1)}>Previous</Link>
          ) : (
            <span>Previous</span>
          )}
          <span>
            Page {rows.page} of {rows.pages}
          </span>
          {rows.page < rows.pages ? (
            <Link href={pageHref(rows.page + 1)}>Next</Link>
          ) : (
            <span>Next</span>
          )}
        </nav>
      )}
    </section>
  );
}
