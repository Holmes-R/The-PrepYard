"use client";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
  effectiveOrder,
  parseOrder,
  toggleOrder,
} from "@/features/questions/sorting.mjs";
export function QuestionHeader({
  company = false,
  hideTopics = false,
  order,
  sort,
  onChange,
  disabled = false,
}: {
  company?: boolean;
  hideTopics?: boolean;
  order?: string;
  sort: string;
  onChange: (order: string) => void;
  disabled?: boolean;
}) {
  const active = effectiveOrder(order, sort),
    rules = parseOrder(active);
  function column(key: string, label: string) {
    const index = rules.findIndex((s) => s.key === key),
      rule = rules[index];
    return (
      <button
        type="button"
        className={"prep-column-sort" + (rule ? " is-sorted" : "")}
        disabled={disabled}
        aria-label={
          "Sort by " +
          label +
          (rule
            ? ", priority " +
              (index + 1) +
              ", " +
              (rule.direction === "asc" ? "ascending" : "descending")
            : "")
        }
        title="Click to sort, click again to reverse, then remove. Up to three columns, in click order."
        onClick={() =>
          onChange(
            toggleOrder(
              order ? active : rules.some((s) => s.key === key) ? active : "",
              key,
            ),
          )
        }
      >
        <span>{label}</span>
        {rule && <small aria-hidden="true">{index + 1}</small>}
        {rule ? (
          rule.direction === "asc" ? (
            <ArrowUp size={14} aria-hidden="true" />
          ) : (
            <ArrowDown size={14} aria-hidden="true" />
          )
        ) : (
          <ArrowUpDown size={14} aria-hidden="true" />
        )}
      </button>
    );
  }
  return (
    <div
      className={
        (company ? "question-column-labels" : "dsa-column-headings") +
        " prep-question-header" +
        (hideTopics ? " dsa-hide-topics" : "")
      }
    >
      <span className="prep-header-status" />
      {column("title", "Question")}
      {column("difficulty", "Difficulty")}
      {!hideTopics && <span className="prep-header-topics">Topics</span>}
      {company && column("frequency", "Frequency")}
      {column("revision", "Revision")}
      <span className="prep-header-note">Note</span>
    </div>
  );
}
