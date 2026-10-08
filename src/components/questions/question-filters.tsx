"use client";
import { useId, useState, type ReactNode, type FormEventHandler } from "react";
import Link from "next/link";
import { Check, ChevronDown, Search, SlidersHorizontal } from "lucide-react";
type Topic = { slug: string; name: string; count?: number };
function TopicPicker({
  topics,
  selected,
  multiple = false,
}: {
  topics: Topic[];
  selected: string[];
  multiple?: boolean;
}) {
  const [values, setValues] = useState(selected),
    [expanded, setExpanded] = useState(false);
  const id = useId();
  const sorted = [...topics].sort(
    (a, b) => (b.count ?? 0) - (a.count ?? 0) || a.name.localeCompare(b.name),
  );
  const visible = expanded
    ? sorted
    : sorted.filter((t, i) => i < 10 || values.includes(t.slug));
  return (
    <fieldset className="prep-topic-chip-picker">
      <legend>Topics</legend>
      {values.length ? (
        values.map((value) => (
          <input
            key={value}
            type="hidden"
            name={multiple ? "topics" : "topic"}
            value={value}
          />
        ))
      ) : (
        <input type="hidden" name={multiple ? "topics" : "topic"} value="" />
      )}
      <div className="prep-topic-chip-layout">
        <div className="prep-topic-chip-list" id={id}>
          <button
            type="button"
            className="prep-topic-chip"
            aria-pressed={values.length === 0}
            onClick={() => setValues([])}
          >
            All topics
            {values.length === 0 && <Check size={13} aria-hidden="true" />}
          </button>
          {visible.map((topic) => {
            const checked = values.includes(topic.slug);
            return (
              <button
                type="button"
                className="prep-topic-chip"
                key={topic.slug}
                aria-label={"Filter by topic: " + topic.name}
                aria-pressed={checked}
                disabled={multiple && !checked && values.length >= 12}
                onClick={() =>
                  setValues(
                    multiple
                      ? checked
                        ? values.filter((v) => v !== topic.slug)
                        : [...values, topic.slug]
                      : checked
                        ? []
                        : [topic.slug],
                  )
                }
              >
                <span>{topic.name}</span>
                {topic.count !== undefined && (
                  <small>{topic.count.toLocaleString()}</small>
                )}
                {checked && <Check size={13} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        {sorted.length > 10 && (
          <button
            type="button"
            className="prep-topics-expand"
            aria-expanded={expanded}
            aria-controls={id}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>
    </fieldset>
  );
}
export function QuestionFilters({
  q,
  difficulty,
  progress,
  topics,
  selectedTopics,
  multipleTopics = false,
  progressOptions,
  action,
  onSubmit,
  onReset,
  resetHref,
  loading = false,
  children,
  extraActions,
  order = "",
  sort = "recommended",
  sortSelect = false,
}: {
  q: string;
  difficulty: string;
  progress: string;
  topics: Topic[];
  selectedTopics: string[];
  multipleTopics?: boolean;
  progressOptions: { slug: string; name: string }[];
  action?: string;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  onReset?: () => void;
  resetHref?: string;
  loading?: boolean;
  children?: ReactNode;
  extraActions?: ReactNode;
  order?: string;
  sort?: string;
  sortSelect?: boolean;
}) {
  return (
    <form
      className="prep-question-filters"
      action={action}
      method={onSubmit ? undefined : "get"}
      onSubmit={(event) => {
        const form = event.currentTarget;
        const selected = form.querySelector<HTMLSelectElement>(
          'select[name="sort"]',
        );
        if (selected && selected.value !== sort) {
          const input = form.querySelector<HTMLInputElement>(
            'input[name="order"]',
          );
          if (input) input.value = "";
        }
        onSubmit?.(event);
      }}
    >
      <input type="hidden" name="order" value={order} />
      {!sortSelect && <input type="hidden" name="sort" value={sort} />}
      <div className="prep-filter-main">
        <label className="prep-filter-field prep-filter-search">
          <span>Question</span>
          <div>
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              name="q"
              defaultValue={q}
              maxLength={100}
              placeholder="Search questions…"
            />
          </div>
        </label>
        <label className="prep-filter-field">
          <span>Difficulty</span>
          <select
            name="difficulty"
            aria-label="Difficulty"
            defaultValue={difficulty}
          >
            <option value="">All difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>

        <label className="prep-filter-field">
          <span>Progress</span>
          <select name="progress" aria-label="Progress" defaultValue={progress}>
            {progressOptions.map((o) => (
              <option key={o.slug} value={o.slug}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <TopicPicker
        topics={topics}
        selected={selectedTopics}
        multiple={multipleTopics}
      />
      <div className="prep-filter-footer">
        <div className="prep-filter-actions">
          <button
            type="submit"
            className="prep-filter-apply"
            disabled={loading}
          >
            Apply
          </button>
          {onReset ? (
            <button
              type="button"
              className="prep-filter-reset"
              onClick={onReset}
              disabled={loading}
            >
              Reset
            </button>
          ) : (
            <Link
              href={resetHref ?? action ?? "/patterns"}
              className="prep-filter-reset"
            >
              Reset
            </Link>
          )}
          {extraActions}
        </div>
        {children && (
          <details className="prep-filter-more">
            <summary>
              <SlidersHorizontal size={15} aria-hidden="true" />
              More filters
              <ChevronDown size={14} aria-hidden="true" />
            </summary>
            <div className="prep-filter-extra">{children}</div>
          </details>
        )}
      </div>
    </form>
  );
}
