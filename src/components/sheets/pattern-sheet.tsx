"use client";
import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ChevronDown,
  Circle,
  CircleCheck,
  Code2,
  Search,
  Shuffle,
  StickyNote,
} from "lucide-react";
import { saveQuestionProgress } from "@/features/progress/actions";
import type {
  Choice,
  PatternFilters,
  PatternOverview,
  PatternQuestion,
  PatternRows,
} from "@/features/patterns/queries.mjs";

function paramsFor(
  filters: PatternFilters,
  patch: Partial<PatternFilters> = {},
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, ...patch }))
    if (value && key !== "page") params.set(key, String(value));
  return params;
}
function Meter({
  solved,
  total,
  label,
}: {
  solved: number;
  total: number;
  label: string;
}) {
  return (
    <div
      className="dsa-meter"
      role="progressbar"
      aria-label={label}
      aria-valuenow={solved}
      aria-valuemin={0}
      aria-valuemax={Math.max(total, 1)}
    >
      <span style={{ width: `${total ? (100 * solved) / total : 0}%` }} />
    </div>
  );
}
function Question({
  question: q,
  filters,
  onSaved,
}: {
  question: PatternQuestion;
  filters: PatternFilters;
  onSaved: () => Promise<void>;
}) {
  const [pending, start] = useTransition();
  const [notesOpen, setNotesOpen] = useState(false);
  const [note, setNote] = useState(q.note);
  const [message, setMessage] = useState("");
  const hideTopics = filters.hideTopics === "1";
  function save(kind: "solved" | "note", value: boolean | string) {
    start(async () => {
      setMessage("");
      const result = await saveQuestionProgress(q.id, kind, value);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setMessage("Saved");
      if (kind === "note") setNotesOpen(false);
      await onSaved();
    });
  }
  return (
    <article className="dsa-question">
      <div className="dsa-question-main">
        <button
          className="dsa-complete"
          aria-label={`${q.status === "solved" ? "Mark unsolved" : "Mark solved"}: ${q.title}`}
          aria-pressed={q.status === "solved"}
          disabled={pending}
          onClick={() => save("solved", q.status !== "solved")}
        >
          {q.status === "solved" ? <CircleCheck /> : <Circle />}
        </button>
        <div className="dsa-question-title">
          <a
            className="dsa-problem-link"
            href={q.canonical_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {q.title}
            <ArrowUpRight size={15} aria-hidden="true" />
            <span className="sr-only">
              {" "}
              (opens on {q.platform} in a new tab)
            </span>
          </a>
          {!hideTopics && (
            <div className="dsa-tags" aria-label="Question patterns">
              {!q.patterns.length && (
                <span title="A verified pattern has not been assigned yet">
                  Pattern pending
                </span>
              )}
              {q.patterns.map((p) => (
                <Link
                  key={p.slug}
                  href={"/patterns?" + paramsFor(filters, { pattern: p.slug })}
                  title={"Filter by " + p.name}
                  aria-current={filters.pattern === p.slug ? "true" : undefined}
                >
                  {p.name}
                </Link>
              ))}
            </div>
          )}
        </div>
        <a
          className="dsa-platform"
          href={q.canonical_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${q.title} on ${q.platform} (new tab)`}
        >
          <Code2 size={21} />
          <span>{q.platform}</span>
          <ArrowUpRight size={14} />
        </a>
        <span className={"dsa-difficulty " + (q.difficulty ?? "")}>
          {q.difficulty ?? "Unrated"}
        </span>
        <div className="dsa-actions">
          <button
            aria-label={`Notes: ${q.title}`}
            title="Private notes"
            aria-expanded={notesOpen}
            aria-controls={"note-" + q.id}
            className={q.note ? "dsa-has-note" : ""}
            onClick={() => setNotesOpen(!notesOpen)}
          >
            <StickyNote size={22} />
          </button>
        </div>
      </div>
      {notesOpen && (
        <form
          className="dsa-note"
          id={"note-" + q.id}
          onSubmit={(e) => {
            e.preventDefault();
            save("note", note);
          }}
        >
          <label htmlFor={"note-input-" + q.id}>Your private notes</label>
          <textarea
            id={"note-input-" + q.id}
            value={note}
            maxLength={50000}
            rows={4}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Approach, edge cases, complexity…"
          />
          <div>
            <button disabled={pending} type="submit">
              {pending ? "Saving…" : "Save note"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setNote(q.note);
                setNotesOpen(false);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {message && (
        <p className="dsa-save-message" role="status">
          {message}
        </p>
      )}
    </article>
  );
}
function Topic({
  group,
  filters,
  initialOpen,
}: {
  group: PatternOverview["groups"][number];
  filters: PatternFilters;
  initialOpen: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PatternRows | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(initialOpen);
  const [retry, setRetry] = useState(0);
  const url =
    "/api/patterns?" +
    paramsFor(filters, { topic: group.slug }) +
    "&page=" +
    page;
  const fetchRows = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch(url, { cache: "no-store", signal });
        if (!response.ok) throw new Error();
        const body: PatternRows = await response.json();
        if (!signal?.aborted) setData(body);
      } catch {
        if (!signal?.aborted)
          setError("Could not load these questions. Please try again.");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [url],
  );
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void fetch(url, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Questions unavailable");
        return (await response.json()) as PatternRows;
      })
      .then((body) => {
        if (!controller.signal.aborted) setData(body);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Could not load these questions. Please try again.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, url, retry]);
  const saved = async () => {
    setLoading(true);
    setError("");
    await fetchRows();
    router.refresh();
  };
  const total = data?.total ?? group.total;
  const solved = data?.solved ?? group.solved;
  return (
    <section className="dsa-topic">
      <Meter solved={solved} total={total} label={group.name + " completion"} />
      <h2>
        <button
          className="dsa-topic-toggle"
          aria-expanded={open}
          aria-controls={"topic-" + group.slug}
          onClick={() => {
            if (!open) {
              setLoading(true);
              setError("");
            }
            setOpen(!open);
          }}
        >
          <span className="dsa-topic-number">
            {String(group.position + 1).padStart(2, "0")}
          </span>
          <span>{group.name}</span>
          <span className="dsa-topic-count">
            {solved} / {total}
          </span>
          <ChevronDown size={19} className={open ? "dsa-chevron-open" : ""} />
        </button>
      </h2>
      {open && (
        <div
          id={"topic-" + group.slug}
          className="dsa-topic-body"
          aria-busy={loading}
        >
          {loading && (
            <p role="status" className="dsa-message">
              Loading questions…
            </p>
          )}
          {error ? (
            <div className="dsa-message" role="alert">
              {error}{" "}
              <button
                onClick={() => {
                  setLoading(true);
                  setError("");
                  setRetry(retry + 1);
                }}
              >
                Try again
              </button>
            </div>
          ) : (
            !loading &&
            data && (
              <>
                {!data.rows.length ? (
                  <p className="dsa-message">
                    No questions match these filters.
                  </p>
                ) : (
                  data.rows.map((q) => (
                    <Question
                      key={q.id}
                      question={q}
                      filters={filters}
                      onSaved={saved}
                    />
                  ))
                )}
                {data.pages > 1 && (
                  <nav
                    className="dsa-pagination"
                    aria-label={group.name + " question pages"}
                  >
                    <button
                      disabled={data.page <= 1}
                      onClick={() => {
                        setLoading(true);
                        setError("");
                        setPage(data.page - 1);
                      }}
                    >
                      Previous
                    </button>
                    <span>
                      Page {data.page} of {data.pages}
                    </span>
                    <button
                      disabled={data.page >= data.pages}
                      onClick={() => {
                        setLoading(true);
                        setError("");
                        setPage(data.page + 1);
                      }}
                    >
                      Next
                    </button>
                  </nav>
                )}
              </>
            )
          )}
        </div>
      )}
    </section>
  );
}
const DIFFICULTIES = ["", "easy", "medium", "hard"];
const CHIP_LIMIT = 12;
function Select({
  name,
  label,
  value,
  options,
  placeholder,
}: {
  name: string;
  label: string;
  value: string;
  options: Choice[];
  placeholder: string;
}) {
  return (
    <label className="dsa-filter">
      <span>{label}</span>
      <select name={name} defaultValue={value}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.slug} value={o.slug}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
export function PatternSheet({
  overview,
  filters,
}: {
  overview: PatternOverview;
  filters: PatternFilters;
}) {
  const groups = overview.groups;
  const [showAllTopics, setShowAllTopics] = useState(false);
  const shuffled = filters.sort === "random";
  // The selection is the reason the reader is here, so it is never hidden behind
  // the "+N more" control.
  const selectedIndex = groups.findIndex((g) => g.slug === filters.topic);
  const visibleGroups =
    showAllTopics || selectedIndex >= CHIP_LIMIT
      ? groups
      : groups.slice(0, CHIP_LIMIT);
  const hiddenTopics = groups.length - visibleGroups.length;
  return (
    <section
      id="dsa-practice"
      className="dsa-sheet"
      aria-label="DSA practice sheet"
    >
      <header className="dsa-hero">
        <div>
          <p className="dsa-eyebrow">
            <Code2 size={17} /> THE PRACTICE ROOM
          </p>
          <h1>
            DSA Practice<span>.</span>
          </h1>
          <p className="dsa-description">
            One topic at a time. Find the patterns. Build your confidence.
          </p>
          <div className="dsa-hero-tags">
            <span>{overview.groups.length} topics</span>
            <span>Pattern-based practice</span>
            <span>Your progress, saved</span>
          </div>
        </div>
        <div className="dsa-progress-card">
          <span>YOUR PROGRESS</span>
          <strong>
            {overview.solved}
            <small> / {overview.total}</small>
          </strong>
          <Meter
            total={overview.total}
            solved={overview.solved}
            label="Matching questions completed"
          />
          <p>
            {overview.total
              ? Math.round((100 * overview.solved) / overview.total)
              : 0}
            % complete · matching questions
          </p>
        </div>
      </header>
      <form action="/patterns" method="get" className="dsa-filters">
        <label className="dsa-filter dsa-search">
          <span className="sr-only">Filter problems or topics</span>
          <div>
            <Search size={17} />
            <input
              type="search"
              name="q"
              defaultValue={filters.q}
              placeholder="Filter problems or topics…"
              maxLength={100}
            />
          </div>
        </label>
        <div className="dsa-primary-row">
          <fieldset className="dsa-segmented">
            <legend className="sr-only">Difficulty</legend>
            {DIFFICULTIES.map((slug) => (
              <label
                key={slug || "all"}
                className={filters.difficulty === slug ? "is-active" : ""}
              >
                <input
                  type="radio"
                  name="difficulty"
                  value={slug}
                  defaultChecked={filters.difficulty === slug}
                />
                <span>
                  {slug ? slug[0].toUpperCase() + slug.slice(1) : "All"}
                </span>
              </label>
            ))}
          </fieldset>
          <button type="submit" className="dsa-apply">
            Apply
          </button>
          {/* A link, not a submit button: it needs no form round-trip and leaves whatever is
              typed in the search box alone. It toggles, because with no Order
              control this is the only way back to the recommended order. */}
          <Link
            className={"dsa-random" + (shuffled ? " is-active" : "")}
            href={
              "/patterns?" +
              paramsFor(filters, { sort: shuffled ? "" : "random" })
            }
            aria-pressed={shuffled}
          >
            <Shuffle size={15} /> {shuffled ? "Shuffled" : "Random"}
          </Link>
          <label className="dsa-check">
            <input
              type="checkbox"
              name="hideTopics"
              value="1"
              defaultChecked={filters.hideTopics === "1"}
            />
            <span>Hide topics</span>
          </label>
        </div>
        {groups.length > 0 && (
          <fieldset className="dsa-chips">
            <legend>Topics</legend>
            <button
              type="submit"
              name="topic"
              value=""
              className={filters.topic ? "" : "is-active"}
              aria-current={filters.topic ? undefined : "true"}
            >
              All topics
            </button>
            {visibleGroups.map((g) => (
              <button
                key={g.slug}
                type="submit"
                name="topic"
                value={g.slug}
                className={filters.topic === g.slug ? "is-active" : ""}
                aria-current={filters.topic === g.slug ? "true" : undefined}
              >
                {g.name} <em>{g.total}</em>
              </button>
            ))}
            {hiddenTopics > 0 && (
              <button
                type="button"
                className="dsa-chips-more"
                aria-expanded={showAllTopics}
                onClick={() => setShowAllTopics(true)}
              >
                +{hiddenTopics} more
              </button>
            )}
            {showAllTopics && visibleGroups.length > CHIP_LIMIT && (
              <button
                type="button"
                className="dsa-chips-more"
                onClick={() => setShowAllTopics(false)}
              >
                Show fewer
              </button>
            )}
          </fieldset>
        )}
        <div className="dsa-secondary-row">
          <Select
            name="pattern"
            label="Pattern"
            value={filters.pattern}
            options={overview.patterns}
            placeholder="All patterns"
          />
          <Select
            name="collection"
            label="Practice collection"
            value={filters.collection}
            options={overview.collections}
            placeholder="All collections"
          />
          <Select
            name="progress"
            label="Progress"
            value={filters.progress}
            options={[
              { slug: "unsolved", name: "Unsolved" },
              { slug: "solved", name: "Solved" },
              { slug: "bookmarked", name: "Bookmarked" },
            ]}
            placeholder="Any progress"
          />
          <Link href="/patterns" className="dsa-reset">
            Reset
          </Link>
        </div>
      </form>
      <div className="dsa-results-heading">
        <h2>Explore your topics</h2>
        <span>{overview.total.toLocaleString()} questions</span>
      </div>
      {filters.pattern && (
        <p className="dsa-active-filter">
          Pattern:{" "}
          <strong>
            {overview.patterns.find((p) => p.slug === filters.pattern)?.name ??
              filters.pattern}
          </strong>
          <Link href={"/patterns?" + paramsFor(filters, { pattern: "" })}>
            Clear pattern ×
          </Link>
        </p>
      )}
      {groups.length ? (
        groups.map((g, i) => (
          <Topic
            key={g.slug}
            group={g}
            filters={filters}
            initialOpen={i === 0}
          />
        ))
      ) : (
        <div className="dsa-empty">
          <Search size={28} />
          <h2>No matching questions</h2>
          <p>Try another topic or pattern, or clear your filters.</p>
          <Link href="/patterns">Reset filters</Link>
        </div>
      )}
    </section>
  );
}
