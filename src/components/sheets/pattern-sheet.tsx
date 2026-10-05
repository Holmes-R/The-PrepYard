"use client";
import {
  useCallback,
  useEffect,
  useOptimistic,
  useState,
  useTransition,
} from "react";
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
import { SaveMessage } from "@/components/feedback/save-message";
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
  const [note, setNote] = useState("");
  const [noteState, setNoteState] = useState<"idle" | "loading" | "ready">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const [savedKey, setSavedKey] = useState(0);
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(q.status);
  const solved = optimisticStatus === "solved";
  const hideTopics = filters.hideTopics === "1";
  const noteId = "note-" + q.id;
  function save(kind: "solved" | "note", value: boolean | string) {
    if (kind === "solved")
      setOptimisticStatus(value ? "solved" : "not_started");
    start(async () => {
      setMessage("");
      const result = await saveQuestionProgress(q.id, kind, value);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setSavedKey((key) => key + 1);
      if (kind === "note") setNotesOpen(false);
      await onSaved();
    });
  }
  function toggleNotes() {
    if (notesOpen || noteState === "ready") {
      setNotesOpen(!notesOpen);
      return;
    }
    if (noteState === "loading") return;
    setNoteState("loading");
    setMessage("");
    void fetch("/api/notes/" + q.id, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const body = await response.json();
        setNote(typeof body.note === "string" ? body.note : "");
        setNoteState("ready");
        setNotesOpen(true);
      })
      .catch(() => {
        setNoteState("idle");
        setMessage("Could not load notes. Please try again.");
      });
  }
  return (
    <article className="dsa-question">
      <div className="dsa-question-main">
        <button
          className="dsa-complete"
          aria-label={`${solved ? "Mark unsolved" : "Mark solved"}: ${q.title}`}
          aria-pressed={solved}
          disabled={pending}
          onClick={() => save("solved", !solved)}
        >
          {solved ? (
            <CircleCheck aria-hidden="true" />
          ) : (
            <Circle aria-hidden="true" />
          )}
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
            aria-controls={noteId}
            className={q.has_note ? "dsa-has-note" : ""}
            onClick={toggleNotes}
          >
            <StickyNote size={22} aria-hidden="true" />
          </button>
        </div>
      </div>
      {noteState === "loading" && !notesOpen && (
        <p role="status" className="dsa-message">
          Loading notes…
        </p>
      )}
      {notesOpen && (
        <form
          className="dsa-note"
          id={noteId}
          onSubmit={(e) => {
            e.preventDefault();
            save("note", note);
          }}
        >
          <label htmlFor={noteId + "-input"}>Your private notes</label>
          <textarea
            id={noteId + "-input"}
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
              onClick={() => setNotesOpen(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {message && (
        <p className="dsa-save-message" role="alert">
          {message}
        </p>
      )}
      {savedKey > 0 && !message && (
        <SaveMessage key={savedKey} className="dsa-save-message" />
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
  // One fetch path for mount, retry, paging and post-save refresh. The effect only
  // cancels it; the duplicated inline fetch it replaced double-fired on mount.
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    // Fetching here is the effect's job (synchronizing remote rows with the open
    // state), not a render cascade: it runs once per open/retry/page change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchRows(controller.signal);
    return () => controller.abort();
  }, [open, url, retry, fetchRows]);
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
      <h3>
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
          <ChevronDown
            size={19}
            aria-hidden="true"
            className={open ? "dsa-chevron-open" : ""}
          />
        </button>
      </h3>
      {open && (
        <div
          id={"topic-" + group.slug}
          className="dsa-topic-body dsa-enter"
          aria-busy={loading}
        >
          {loading && !data && (
            <div
              role="status"
              className="dsa-skeleton"
              aria-label="Loading questions"
            >
              <span className="sr-only">Loading questions…</span>
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="dsa-skeleton-row" aria-hidden="true">
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
  const router = useRouter();
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
            <Code2 size={17} aria-hidden="true" /> THE PRACTICE ROOM
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
            <Search size={17} aria-hidden="true" />
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
          {/* A button, not a link: it toggles a state (pressed or not) rather than
              navigating to a destination, and aria-pressed is invalid on links.
              Navigation happens through the router so the search box keeps
              whatever is typed in it. */}
          <button
            type="button"
            className={"dsa-random" + (shuffled ? " is-active" : "")}
            aria-pressed={shuffled}
            onClick={() =>
              router.push(
                "/patterns?" +
                  paramsFor(filters, { sort: shuffled ? "" : "random" }),
              )
            }
          >
            <Shuffle size={15} aria-hidden="true" />{" "}
            {shuffled ? "Shuffled" : "Random"}
          </button>
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
          <fieldset className="dsa-chips" id="dsa-topic-chips">
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
            {/*
              One toggle, not two buttons: the expanded state always lives in one
              place, so the control can honestly report it. The selection forces
              the full list open (see above), which also counts as expanded.
            */}
            {(hiddenTopics > 0 || showAllTopics) && (
              <button
                type="button"
                className="dsa-chips-more"
                aria-expanded={showAllTopics || selectedIndex >= CHIP_LIMIT}
                aria-controls="dsa-topic-chips"
                onClick={() => setShowAllTopics(!showAllTopics)}
              >
                {showAllTopics ? "Show fewer" : `+${hiddenTopics} more`}
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
      {filters.collection && (
        <p className="dsa-active-filter">
          Collection:{" "}
          <strong>
            {overview.collections.find((c) => c.slug === filters.collection)
              ?.name ?? filters.collection}
          </strong>{" "}
          · {overview.total.toLocaleString()} questions
          <Link href={"/patterns?" + paramsFor(filters, { collection: "" })}>
            Clear collection ×
          </Link>
        </p>
      )}
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
          <Search size={28} aria-hidden="true" />
          <h2>No matching questions</h2>
          <p>Try another topic or pattern, or clear your filters.</p>
          <Link href="/patterns">Reset filters</Link>
        </div>
      )}
    </section>
  );
}
