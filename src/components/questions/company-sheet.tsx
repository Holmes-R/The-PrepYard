"use client";
import { useState, useTransition, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Circle,
  CircleCheck,
  RotateCcw,
  StickyNote,
  Search,
} from "lucide-react";
import { saveQuestionProgress } from "@/features/progress/actions";
import {
  windowLabels,
  progressLabels,
  type Sheet,
  type Filters,
} from "@/features/catalogue/queries.mjs";
export type CompanyItem = {
  slug: string;
  name: string;
  has_logo?: boolean;
  question_count: number;
  solved_count: number;
};
const LOGO_COLOURS = [
  "#e5322d",
  "#0052cc",
  "#7b3ff2",
  "#f2620a",
  "#0a84ff",
  "#0f9d58",
  "#e0218a",
  "#c47f00",
];
/** First letters of the first two words: "J.P. Morgan" -> "JM", "6sense" -> "6S". */
function companyInitials(name: string) {
  const words = name.split(/[\s.&/+\-_,]+/).filter(Boolean);
  if (!words.length) return "?";
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}
function logoColour(name: string) {
  let hash = 0;
  for (const character of name)
    hash = (hash * 31 + character.codePointAt(0)!) % LOGO_COLOURS.length;
  return LOGO_COLOURS[hash];
}
function CompanyLogo({
  name,
  slug,
  available,
}: {
  name: string;
  slug: string;
  available?: boolean;
}) {
  // Most of the directory has no stored mark, and the route answers 404 for those.
  // The monogram is the normal appearance, so it must not cost a request per card
  // once it is known to be missing.
  const [failed, setFailed] = useState(false);
  if (failed || available === false)
    return (
      <span
        className="company-logo"
        style={{ color: logoColour(name) }}
        aria-hidden="true"
      >
        {companyInitials(name)}
      </span>
    );
  return (
    <span className="company-logo-tile">
      {/* A stored mark is third-party artwork of unknown size, so it is bounded
          rather than trusted to lay out. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={"/api/logos/" + slug}
        alt=""
        width={40}
        height={40}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
function QuestionRow({
  question,
  onSaved,
  window,
}: {
  question: Sheet["rows"][number];
  window: string;
  onSaved: () => Promise<void>;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [note, setNote] = useState(question.note);
  const save = (kind: "solved" | "note", value: boolean | string) =>
    start(async () => {
      setMessage("");
      const result = await saveQuestionProgress(question.id, kind, value);
      if (result.ok) {
        await onSaved();
        if (kind === "note") setNotesOpen(false);
      } else setMessage(result.message);
    });
  return (
    <div className="company-question-wrap">
      <div className="company-question-row">
        <button
          className="completion-button"
          title={question.status === "solved" ? "Mark unsolved" : "Mark solved"}
          aria-label={
            (question.status === "solved"
              ? "Mark unsolved: "
              : "Mark solved: ") + question.title
          }
          aria-pressed={question.status === "solved"}
          disabled={pending}
          onClick={() => save("solved", question.status !== "solved")}
        >
          {question.status === "solved" ? (
            <CircleCheck size={22} />
          ) : (
            <Circle size={22} />
          )}
        </button>
        <div className="question-title-block">
          <a
            href={question.canonical_url}
            target="_blank"
            rel="noopener noreferrer"
            className="question-title"
          >
            {question.title}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <div className="question-topics" aria-label="Question patterns">
            {question.patterns.length ? (
              question.patterns.map((pattern) => (
                <Link
                  key={pattern.slug}
                  href={"/patterns?pattern=" + encodeURIComponent(pattern.slug)}
                >
                  {pattern.name}
                </Link>
              ))
            ) : (
              <span title="A verified pattern has not been assigned yet">
                Pattern pending
              </span>
            )}
          </div>
          <div className="company-tags">
            {question.companies.slice(0, 4).map((c) => (
              <Link
                key={c.slug}
                href={
                  "/companies/" +
                  c.slug +
                  "?window=" +
                  encodeURIComponent(window)
                }
              >
                {c.name}
                {c.frequency === null ? "" : " · " + c.frequency + "%"}
              </Link>
            ))}
            {question.companies.length > 4 && (
              <span
                title={question.companies
                  .slice(4)
                  .map((c) => c.name)
                  .join(", ")}
              >
                {question.companies.length - 4} more companies
              </span>
            )}
          </div>
        </div>
        <a
          className="platform-link"
          href={question.canonical_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={"Open on " + question.platform}
          title={question.platform}
        >
          <svg width="24" height="28" viewBox="0 0 24 28" aria-hidden="true">
            <path
              d="M16 3 4 15a5 5 0 0 0 0 7l3 3a5 5 0 0 0 7 0l3-3"
              fill="none"
              stroke="#f5a623"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="m10 9 6 6M9 19h13"
              fill="none"
              stroke="#e8e8ed"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </a>
        <span className={"difficulty difficulty-" + question.difficulty}>
          {question.difficulty
            ? question.difficulty[0].toUpperCase() +
              question.difficulty.slice(1)
            : "Unknown"}
        </span>
        <span
          className="question-frequency"
          title="Relative frequency in the selected window"
        >
          {question.frequency === null ? "—" : question.frequency + "%"}
        </span>
        <div className="question-utilities">
          <button
            className={"note-button " + (question.note ? "has-note" : "")}
            title="Question notes"
            aria-label={"Notes for " + question.title}
            aria-expanded={notesOpen}
            onClick={() => {
              setNotesOpen(!notesOpen);
              setNote(question.note);
            }}
          >
            <StickyNote size={23} />
          </button>
        </div>
      </div>
      {notesOpen && (
        <form
          className="question-notes"
          onSubmit={(event) => {
            event.preventDefault();
            save("note", note);
          }}
        >
          <label>
            Your private notes
            <textarea
              autoFocus
              value={note}
              maxLength={50000}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
            />
          </label>
          <div>
            <button className="sheet-apply" disabled={pending}>
              Save notes
            </button>
            <button type="button" onClick={() => setNotesOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {message && (
        <p className="sheet-error" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
export const defaultFilters: Filters = {
  q: "",
  difficulty: "",
  window: "all",
  sort: "frequency-desc",
  topics: [],
  progress: "any",
  minFrequency: null,
  minAcceptance: null,
  page: 1,
};
function useCompanySheet(
  company: CompanyItem,
  initial?: Sheet,
  initialFilters: Filters = defaultFilters,
) {
  const router = useRouter();
  const [sheet, setSheet] = useState<Sheet | undefined>(initial);
  const [filters, setFilters] = useState(initialFilters);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const load = async (next = filters) => {
    const request = ++sequence.current;
    setLoading(true);
    setError("");
    // URLSearchParams only takes strings, and an empty value must be omitted rather
    // than sent as "", so the reader on the other side sees the documented default.
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
      if (key === "page" || key === "topics") continue;
      if (value === "" || value === null) continue;
      params.set(key, String(value));
    }
    for (const topic of next.topics) params.append("topics", topic);
    params.set("page", String(next.page));
    try {
      const response = await fetch(
        "/api/companies/" + company.slug + "?" + params.toString(),
        { cache: "no-store" },
      );
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error();
      const data: Sheet = await response.json();
      if (request === sequence.current) {
        setSheet(data);
        setFilters(next);
      }
    } catch {
      if (request === sequence.current)
        setError("Could not load questions. Please try again.");
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  };
  return { sheet, filters, loading, error, load };
}
function percentValue(raw: FormDataEntryValue | null) {
  const text = String(raw ?? "").trim();
  return /^\d{1,3}(?:\.\d{1,2})?$/.test(text) && Number(text) <= 100
    ? Number(text)
    : null;
}
function CompanyQuestions({
  sheet,
  filters,
  loading,
  error,
  load,
}: {
  sheet: Sheet | undefined;
  filters: Filters;
  loading: boolean;
  error: string;
  load: (next?: Filters) => Promise<void>;
}) {
  // Offering a window the company has no observations for returns an empty sheet
  // that looks like a bug, so the options follow the data.
  const windows = (
    sheet?.available?.length ? sheet.available : Object.keys(windowLabels)
  ).sort(
    (a, b) =>
      Object.keys(windowLabels).indexOf(a) -
      Object.keys(windowLabels).indexOf(b),
  );
  // A bookmarked URL can name a window this company has no observations for. Offering
  // it would silently disagree with the results, so the request falls back to all time.
  const window_ = windows.includes(filters.window) ? filters.window : "all";
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void load({
      q: String(data.get("q") || ""),
      difficulty: String(data.get("difficulty") || ""),
      window: String(data.get("window") || "all"),
      sort: String(data.get("sort") || "frequency-desc"),
      topics: data.getAll("topics").map(String),
      progress: String(data.get("progress") || "any"),
      minFrequency: percentValue(data.get("minFrequency")),
      minAcceptance: percentValue(data.get("minAcceptance")),
      page: 1,
    });
  };
  const topics = sheet?.topics ?? [];
  // The form is uncontrolled, so it is remounted whenever the applied filters change.
  // Without this, Reset and paging would change the results while the inputs still
  // showed the previous values.
  const applied = JSON.stringify(filters);
  return (
    <div className="company-panel-body">
      <form className="sheet-filters" onSubmit={submit} key={applied}>
        <label className="sheet-field sheet-field-title">
          Question title
          <input
            name="q"
            type="search"
            maxLength={100}
            defaultValue={filters.q}
            placeholder="Search questions…"
          />
        </label>
        <label className="sheet-field">
          Difficulty
          <select name="difficulty" defaultValue={filters.difficulty}>
            <option value="">All difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <label className="sheet-field">
          Window
          <select name="window" defaultValue={window_}>
            {windows.map((key) => (
              <option key={key} value={key}>
                {windowLabels[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="sheet-field">
          My progress
          <select name="progress" defaultValue={filters.progress}>
            {Object.entries(progressLabels)
              .filter(([key]) => !["bookmarked", "revision"].includes(key))
              .map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
          </select>
        </label>
        <label className="sheet-field">
          Sort
          <select name="sort" defaultValue={filters.sort}>
            <option value="frequency-desc">Highest frequency</option>
            <option value="frequency-asc">Lowest frequency</option>
            <option value="acceptance-desc">Highest acceptance</option>
            <option value="title">Title A–Z</option>
            <option value="title-desc">Title Z–A</option>
          </select>
        </label>
        <label className="sheet-field sheet-field-narrow">
          Min frequency %
          <input
            name="minFrequency"
            type="number"
            min={0}
            max={100}
            step={0.5}
            inputMode="decimal"
            placeholder="any"
            defaultValue={filters.minFrequency ?? ""}
          />
        </label>
        <label className="sheet-field sheet-field-narrow">
          Min acceptance %
          <input
            name="minAcceptance"
            type="number"
            min={0}
            max={100}
            step={0.5}
            inputMode="decimal"
            placeholder="any"
            defaultValue={filters.minAcceptance ?? ""}
          />
        </label>
        <div className="sheet-filter-actions">
          <button className="sheet-apply" disabled={loading}>
            Apply
          </button>
          <button
            type="button"
            className="sheet-reset"
            disabled={loading}
            onClick={() => void load({ ...defaultFilters })}
          >
            <RotateCcw size={14} /> Reset
          </button>
        </div>
        <fieldset className="sheet-topics">
          <legend>
            Topics
            {filters.topics.length > 0 && (
              <span className="sheet-topic-count">
                {filters.topics.length} selected
              </span>
            )}
          </legend>
          {topics.length > 0 ? (
            <div className="sheet-topic-chips">
              {topics.map((topic) => (
                <label key={topic.slug} className="sheet-topic-chip">
                  <input
                    type="checkbox"
                    name="topics"
                    value={topic.slug}
                    defaultChecked={filters.topics.includes(topic.slug)}
                  />
                  <span>{topic.name}</span>
                  <em>{topic.uses}</em>
                </label>
              ))}
            </div>
          ) : (
            <p className="sheet-message">
              No topic tags yet. They arrive with the catalogue import.
            </p>
          )}
        </fieldset>
      </form>
      {loading && (
        <p role="status" className="sheet-message">
          Loading questions…
        </p>
      )}
      {error && (
        <div className="sheet-error" role="alert">
          {error}
          <button onClick={() => void load()}>Retry</button>
        </div>
      )}
      {sheet && (
        <>
          <div className="question-column-labels" aria-hidden>
            <span>Question</span>
            <span>Platform</span>
            <span>Difficulty</span>
            <span>Frequency</span>
            <span>Notes</span>
          </div>
          <div className="company-question-list" aria-busy={loading}>
            {sheet.rows.map((question) => (
              <QuestionRow
                key={question.id}
                question={question}
                window={filters.window}
                onSaved={() => load()}
              />
            ))}
          </div>
          {!sheet.rows.length && (
            <p className="sheet-message">
              No questions match these filters. Try another title, difficulty,
              topic, or window.
            </p>
          )}
          <div className="sheet-pagination">
            <span>
              {sheet.total} questions · Page {sheet.page} of {sheet.pages}
            </span>
            <div>
              <button
                disabled={sheet.page <= 1 || loading}
                onClick={() => void load({ ...filters, page: sheet.page - 1 })}
              >
                Previous
              </button>
              <button
                disabled={sheet.page >= sheet.pages || loading}
                onClick={() => void load({ ...filters, page: sheet.page + 1 })}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
function CompanyPanel({
  company,
  initial,
  initialFilters,
  open,
  onToggle,
}: {
  company: CompanyItem;
  initial?: Sheet;
  initialFilters?: Filters;
  open: boolean;
  onToggle: () => void;
}) {
  const { sheet, filters, loading, error, load } = useCompanySheet(
    company,
    initial,
    initialFilters,
  );
  const solved = sheet?.solved ?? company.solved_count;
  const total = sheet?.total ?? company.question_count;
  const panelId = "company-" + company.slug;
  return (
    <section className={"company-card " + (open ? "is-open" : "")}>
      <div className="company-card-head">
        <button
          className="company-card-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            onToggle();
            if (!open && !sheet && !loading) void load();
          }}
        >
          <CompanyLogo
            name={company.name}
            slug={company.slug}
            available={company.has_logo}
          />
          <span className="company-card-name">{company.name}</span>
          {open && (
            <span className="company-progress-count">
              {solved} / {total}
            </span>
          )}
        </button>
        <a
          className="company-card-newtab"
          href={"/companies/" + company.slug}
          target="_blank"
          rel="noopener noreferrer"
          title={"Open " + company.name + " in a new tab"}
        >
          <span className="sr-only">Open {company.name} in a new tab</span>
          <ArrowUpRight size={17} aria-hidden="true" />
        </a>
      </div>
      {open && (
        <div id={panelId}>
          <CompanyQuestions
            sheet={sheet}
            filters={filters}
            loading={loading}
            error={error}
            load={load}
          />
        </div>
      )}
    </section>
  );
}
export function CompanySection({
  company,
  initial,
  initialFilters = defaultFilters,
}: {
  company: CompanyItem;
  initial?: Sheet;
  initialFilters?: Filters;
}) {
  const [open, setOpen] = useState(Boolean(initial));
  return (
    <CompanyPanel
      company={company}
      initial={initial}
      initialFilters={initialFilters}
      open={open}
      onToggle={() => setOpen(!open)}
    />
  );
}
const PER_PAGE = 24;
export function CompanyDirectory({ companies }: { companies: CompanyItem[] }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const term = search.trim().toLowerCase();
  const matching = term
    ? companies.filter(
        (c) => c.name.toLowerCase().includes(term) || c.slug.includes(term),
      )
    : companies;
  const pages = Math.max(1, Math.ceil(matching.length / PER_PAGE));
  const current = Math.min(page, pages);
  const visible = matching.slice((current - 1) * PER_PAGE, current * PER_PAGE);
  const activeSlug =
    openSlug && visible.some((c) => c.slug === openSlug) ? openSlug : null;
  return (
    <div className="company-sheet-theme">
      <header className="company-page-heading">
        <p className="sheet-eyebrow">Company-wise practice</p>
        <h1>Company questions</h1>
        <p>
          Choose your company. Practice, track your progress, and keep your
          notes in one place.
        </p>
        <div className="company-directory-toolbar">
          <label className="company-search">
            <Search size={18} />
            <input
              aria-label="Search companies"
              placeholder="Search all companies…"
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
      </header>
      <div className="company-directory-header">
        <h2>All companies</h2>
        <span className="company-directory-count">
          {term
            ? `${matching.length} of ${companies.length} companies`
            : `${matching.length} companies`}
        </span>
      </div>
      <div className="company-grid">
        {visible.map((company) => (
          <CompanyPanel
            key={company.slug}
            company={company}
            open={activeSlug === company.slug}
            onToggle={() =>
              setOpenSlug(activeSlug === company.slug ? null : company.slug)
            }
          />
        ))}
      </div>
      {!visible.length && (
        <p className="sheet-message">No companies match your search.</p>
      )}
      <nav className="sheet-pagination" aria-label="Company pages">
        <span>
          Page {current} of {pages}
        </span>
        <div>
          <button disabled={current <= 1} onClick={() => setPage(current - 1)}>
            Previous
          </button>
          <button
            disabled={current >= pages}
            onClick={() => setPage(current + 1)}
          >
            Next
          </button>
        </div>
      </nav>
      <p className="sheet-footnote">
        Frequencies compare reported percentages within a single window. They do
        not predict which questions you will be asked.
      </p>
    </div>
  );
}
