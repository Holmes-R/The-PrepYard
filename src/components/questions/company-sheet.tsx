"use client";
import {
  useEffect,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
  useRef,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Circle,
  CircleCheck,
  RotateCcw,
  StickyNote,
  Search,
} from "lucide-react";
import { saveQuestionProgress } from "@/features/progress/actions";
import { SaveMessage } from "@/components/feedback/save-message";
import { patternColour } from "@/lib/pattern-colour";
import {
  windowLabels,
  progressLabels,
  filtersFrom,
  filtersToParams,
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
  src,
}: {
  name: string;
  slug: string;
  available?: boolean;
  // A resolved data URL (string), a known miss (null), or not yet resolved
  // (undefined). Unknown renders the monogram without firing a request: the
  // directory resolves the whole visible set in one batched call instead of one
  // authenticated request per card.
  src?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const direct =
    src === undefined && available !== false ? "/api/logos/" + slug : src;
  if (failed || !direct)
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
        src={direct}
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
  const [savedKey, setSavedKey] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const [note, setNote] = useState("");
  const [noteState, setNoteState] = useState<"idle" | "loading" | "ready">(
    "idle",
  );
  // The toggle answers immediately; the server round-trip reconciles it. Reverts
  // automatically if the save fails, because the base value never changed.
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(
    question.status,
  );
  const solved = optimisticStatus === "solved";
  const save = (kind: "solved" | "note", value: boolean | string) => {
    if (kind === "solved")
      // Transient only: un-solving an "attempted" question briefly reads as
      // not-started until the reload lands with the true state.
      setOptimisticStatus(value ? "solved" : "not_started");
    start(async () => {
      setMessage("");
      const result = await saveQuestionProgress(question.id, kind, value);
      if (result.ok) {
        setSavedKey((key) => key + 1);
        await onSaved();
        if (kind === "note") setNotesOpen(false);
      } else setMessage(result.message);
    });
  };
  const noteId = "note-" + question.id;
  const toggleNotes = () => {
    if (notesOpen || noteState === "ready") {
      setNotesOpen(!notesOpen);
      return;
    }
    if (noteState === "loading") return;
    // Content is not in the list payload, so the first open fetches it. A failed
    // fetch leaves the editor closed: opening it empty would let Save silently
    // overwrite the real note with nothing.
    setNoteState("loading");
    setMessage("");
    void fetch("/api/notes/" + question.id, { cache: "no-store" })
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
  };
  return (
    <div className="company-question-wrap" role="listitem">
      <div className="company-question-row">
        <button
          className="completion-button"
          title={solved ? "Mark unsolved" : "Mark solved"}
          aria-label={
            (solved ? "Mark unsolved: " : "Mark solved: ") + question.title
          }
          aria-pressed={solved}
          disabled={pending}
          onClick={() => save("solved", !solved)}
        >
          {solved ? (
            <CircleCheck size={22} aria-hidden="true" />
          ) : (
            <Circle size={22} aria-hidden="true" />
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
                  style={{ color: patternColour(pattern.slug) }}
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
            className={"note-button " + (question.has_note ? "has-note" : "")}
            title="Question notes"
            aria-label={"Notes for " + question.title}
            aria-expanded={notesOpen}
            aria-controls={noteId}
            onClick={toggleNotes}
          >
            <StickyNote size={23} aria-hidden="true" />
          </button>
        </div>
      </div>
      {noteState === "loading" && !notesOpen && (
        <p role="status" className="sheet-message">
          Loading notes…
        </p>
      )}
      {notesOpen && (
        <form
          className="question-notes"
          id={noteId}
          onSubmit={(event) => {
            event.preventDefault();
            save("note", note);
          }}
        >
          <label htmlFor={noteId + "-input"}>
            Your private notes
            <textarea
              id={noteId + "-input"}
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
      {savedKey > 0 && !message && (
        <SaveMessage key={savedKey} className="sheet-saved" />
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
  onApplied,
}: {
  sheet: Sheet | undefined;
  filters: Filters;
  loading: boolean;
  error: string;
  load: (next?: Filters) => Promise<void>;
  // Called whenever the reader applies filters or turns a page, so the caller can
  // mirror them into the address bar. Deliberately not called after saves, which
  // refresh data without changing what is being viewed.
  onApplied: (next: Filters) => void;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState("");
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
    // A non-empty value that is not a number is a typo, not "any": say so instead
    // of silently dropping it.
    const rawMinFrequency = String(data.get("minFrequency") ?? "").trim();
    const rawMinAcceptance = String(data.get("minAcceptance") ?? "").trim();
    const minFrequency = rawMinFrequency ? percentValue(rawMinFrequency) : null;
    const minAcceptance = rawMinAcceptance
      ? percentValue(rawMinAcceptance)
      : null;
    if (
      (rawMinFrequency && minFrequency === null) ||
      (rawMinAcceptance && minAcceptance === null)
    ) {
      setFormError("Minimums must be numbers from 0 to 100.");
      return;
    }
    setFormError("");
    const next = {
      q: String(data.get("q") || ""),
      difficulty: String(data.get("difficulty") || ""),
      window: String(data.get("window") || "all"),
      sort: String(data.get("sort") || "frequency-desc"),
      topics: data.getAll("topics").map(String),
      progress: String(data.get("progress") || "any"),
      minFrequency,
      minAcceptance,
      page: 1,
    };
    void load(next);
    onApplied(next);
  };
  const turnPage = (page: number) => {
    const next = { ...filters, page };
    void load(next);
    onApplied(next);
  };
  // Mutations refresh the server tree too, so directory counts and the open panel's
  // solved tally update without navigating away.
  const refreshAfterSave = async () => {
    await load();
    router.refresh();
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
            aria-invalid={formError ? true : undefined}
            aria-describedby={formError ? "sheet-filter-error" : undefined}
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
            aria-invalid={formError ? true : undefined}
            aria-describedby={formError ? "sheet-filter-error" : undefined}
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
            onClick={() => {
              setFormError("");
              void load({ ...defaultFilters });
              onApplied({ ...defaultFilters });
            }}
          >
            <RotateCcw size={14} aria-hidden="true" /> Reset
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
      {formError && (
        <p id="sheet-filter-error" className="sheet-error" role="alert">
          {formError}
        </p>
      )}
      {loading && !sheet && (
        <div
          role="status"
          className="sheet-skeleton"
          aria-label="Loading questions"
        >
          <span className="sr-only">Loading questions…</span>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="sheet-skeleton-row" aria-hidden="true">
              <span className="sheet-skeleton-dot" />
              <span className="sheet-skeleton-lines">
                <span />
                <span />
              </span>
              <span className="sheet-skeleton-chip" />
              <span className="sheet-skeleton-chip" />
              <span className="sheet-skeleton-dot" />
            </div>
          ))}
        </div>
      )}
      {error && (
        <div className="sheet-error" role="alert">
          {error}
          <button onClick={() => void load()}>Retry</button>
        </div>
      )}
      {sheet && (
        <>
          <div className="question-column-labels" aria-hidden="true">
            <span>Question</span>
            <span>Platform</span>
            <span>Difficulty</span>
            <span>Frequency</span>
            <span>Notes</span>
          </div>
          <div
            className="company-question-list"
            role="list"
            aria-label="Questions"
            aria-busy={loading}
          >
            {sheet.rows.map((question) => (
              <QuestionRow
                key={question.id}
                question={question}
                window={filters.window}
                onSaved={refreshAfterSave}
              />
            ))}
          </div>
          {!sheet.rows.length && !loading && (
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
                onClick={() => turnPage(sheet.page - 1)}
              >
                Previous
              </button>
              <button
                disabled={sheet.page >= sheet.pages || loading}
                onClick={() => turnPage(sheet.page + 1)}
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
  onApplied,
  sync,
  logoSrc,
}: {
  company: CompanyItem;
  initial?: Sheet;
  initialFilters?: Filters;
  open: boolean;
  onToggle: () => void;
  onApplied: (slug: string, next: Filters) => void;
  // Back/forward navigation can land on a filtered view from the address bar.
  // The tick bumps once per such navigation; the panel then loads those filters.
  sync?: { filters: Filters; tick: number } | null;
  logoSrc?: string | null;
}) {
  const { sheet, filters, loading, error, load } = useCompanySheet(
    company,
    initial,
    initialFilters,
  );
  const loadRef = useRef(load);
  // Kept in an effect, not during render: effects and event handlers are the only
  // places refs may be written.
  useEffect(() => {
    loadRef.current = load;
  });
  const didInit = useRef(false);
  // Opened from a shared URL there is nothing to show yet, so fetch immediately
  // with the filters the URL carried instead of waiting for a toggle.
  useEffect(() => {
    if (open && !sheet && !didInit.current) {
      didInit.current = true;
      void loadRef.current();
    }
  }, [open, sheet]);
  useEffect(() => {
    if (sync && open) void loadRef.current(sync.filters);
    // The sync object identity changes once per history landing.
  }, [sync, open]);
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
            if (!open && !sheet && !loading) {
              didInit.current = true;
              void load();
            }
          }}
        >
          <CompanyLogo
            name={company.name}
            slug={company.slug}
            available={company.has_logo}
            src={logoSrc}
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
        <div id={panelId} className="company-panel-enter">
          <CompanyQuestions
            sheet={sheet}
            filters={filters}
            loading={loading}
            error={error}
            load={load}
            onApplied={(next) => onApplied(company.slug, next)}
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
  syncUrl = false,
}: {
  company: CompanyItem;
  initial?: Sheet;
  initialFilters?: Filters;
  // On the dedicated sheet page, applied filters replace the address bar so the
  // exact view is shareable. The directory passes its own handler instead.
  syncUrl?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(initial));
  const router = useRouter();
  const pathname = usePathname();
  return (
    <CompanyPanel
      company={company}
      initial={initial}
      initialFilters={initialFilters}
      open={open}
      onToggle={() => setOpen(!open)}
      onApplied={(_slug, next) => {
        if (!syncUrl) return;
        const query = filtersToParams(next).toString();
        router.replace(query ? pathname + "?" + query : pathname, {
          scroll: false,
        });
      }}
    />
  );
}
const PER_PAGE = 24;
export function CompanyDirectory({
  companies,
  initialOpen = null,
  initialFilters = defaultFilters,
  initialFind = "",
}: {
  companies: CompanyItem[];
  initialOpen?: string | null;
  initialFilters?: Filters;
  initialFind?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(initialFind);
  const [page, setPage] = useState(1);
  const [openSlug, setOpenSlug] = useState<string | null>(
    initialOpen && companies.some((c) => c.slug === initialOpen)
      ? initialOpen
      : null,
  );
  // History travel lands on a filtered view; the tick bumps once per landing and the
  // panel loads those filters. State, not a ref, because the map below reads it
  // during render.
  const [sync, setSync] = useState<{ filters: Filters; tick: number } | null>(
    null,
  );
  // The single source of truth for the address bar. Panels report applied filters
  // here; the directory search commits here debounced.
  const viewRef = useRef({ open: openSlug, filters: initialFilters });
  // A header search submits a full navigation to ?find=, which arrives as new props.
  // This render-time adjustment keeps the box in step; it converges immediately
  // because the guard goes false on the re-render it triggers.
  const [prevFind, setPrevFind] = useState(initialFind);
  if (initialFind !== prevFind) {
    setPrevFind(initialFind);
    setSearch(initialFind);
    setPage(1);
  }
  const commitUrl = (open: string | null, filters: Filters, find: string) => {
    viewRef.current = { open, filters };
    const params = filtersToParams(filters, open ?? "");
    if (find.trim()) params.set("find", find.trim());
    const query = params.toString();
    router.replace(query ? pathname + "?" + query : pathname, {
      scroll: false,
    });
  };
  // Back and forward buttons change the URL without touching state. replace() never
  // fires popstate, so this only answers genuine history travel.
  useEffect(() => {
    const onPopState = () => {
      const url = new URLSearchParams(window.location.search);
      const slug = url.get("open");
      const find = url.get("find") ?? "";
      const next = filtersFrom({
        ...Object.fromEntries(url.entries()),
        topics: url.getAll("topics"),
      });
      setPrevFind(find);
      setSearch(find);
      setPage(1);
      const valid =
        slug && companies.some((c) => c.slug === slug) ? slug : null;
      setOpenSlug(valid);
      viewRef.current = { open: valid, filters: next };
      if (valid)
        setSync((prev) => ({ filters: next, tick: (prev?.tick ?? 0) + 1 }));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [companies]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );
  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      commitUrl(viewRef.current.open, viewRef.current.filters, value);
    }, 500);
  };
  const handleApplied = (slug: string, next: Filters) => {
    commitUrl(slug, next, search);
  };
  const handleToggle = (slug: string) => {
    const next = openSlug === slug ? null : slug;
    setOpenSlug(next);
    // Closing drops the company view from the URL; opening writes it once the
    // panel reports its applied filters.
    if (!next) commitUrl(null, viewRef.current.filters, search);
  };
  const term = search.trim().toLowerCase();
  const matching = useMemo(
    () =>
      term
        ? companies.filter(
            (c) => c.name.toLowerCase().includes(term) || c.slug.includes(term),
          )
        : companies,
    [companies, term],
  );
  const pages = Math.max(1, Math.ceil(matching.length / PER_PAGE));
  const current = Math.min(page, pages);
  // Memoized so the logo effect below only re-runs when the visible set actually
  // changes, not on every unrelated re-render (toggling a panel, saving progress).
  const visible = useMemo(
    () => matching.slice((current - 1) * PER_PAGE, current * PER_PAGE),
    [matching, current],
  );
  const activeSlug =
    openSlug && visible.some((c) => c.slug === openSlug) ? openSlug : null;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const wasActive = useRef(activeSlug);
  // The open card just vanished under the reader's fingers. Say where they are
  // instead of leaving focus on a control whose panel disappeared.
  useEffect(() => {
    if (wasActive.current && !activeSlug) headingRef.current?.focus();
    wasActive.current = activeSlug;
  });
  // Logos for the visible cards arrive in one batched request, keyed by slug, with
  // null marking a known miss. Cards whose flag says no mark exists never enter the
  // request at all, and a failed batch degrades to monograms instead of retrying.
  const [logoMap, setLogoMap] = useState<Record<string, string | null>>({});
  useEffect(() => {
    // Cards flagged as having no mark never enter the request. Everything else
    // resolves here, once, instead of one authenticated request per card.
    const needed = visible
      .filter((c) => c.has_logo !== false && !(c.slug in logoMap))
      .map((c) => c.slug);
    if (!needed.length) return;
    const controller = new AbortController();
    const params = new URLSearchParams();
    for (const slug of needed) params.append("slug", slug);
    void fetch("/api/logos/batch?" + params.toString(), {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        if (!response.ok) throw new Error();
        const body = await response.json();
        const found: Record<string, string | null> = {};
        for (const slug of needed) {
          const hit = body.logos?.[slug];
          found[slug] =
            hit && typeof hit.data === "string"
              ? `data:${hit.content_type};base64,${hit.data}`
              : null;
        }
        if (!controller.signal.aborted)
          setLogoMap((prev) => ({ ...prev, ...found }));
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setLogoMap((prev) => {
            const next = { ...prev };
            for (const slug of needed) if (!(slug in next)) next[slug] = null;
            return next;
          });
      });
    return () => controller.abort();
  }, [visible, logoMap, router]);
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
            <Search size={18} aria-hidden="true" />
            <input
              aria-label="Search companies"
              placeholder="Search all companies…"
              type="search"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </label>
        </div>
      </header>
      <div className="company-directory-header">
        <h2 ref={headingRef} tabIndex={-1}>
          All companies
        </h2>
        <span role="status" className="company-directory-count">
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
            initialFilters={
              company.slug === initialOpen ? initialFilters : undefined
            }
            open={activeSlug === company.slug}
            onToggle={() => handleToggle(company.slug)}
            onApplied={handleApplied}
            sync={company.slug === openSlug ? sync : null}
            logoSrc={logoMap[company.slug] ?? null}
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
