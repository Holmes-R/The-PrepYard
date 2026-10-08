"use client";
import { useState, type CSSProperties } from "react";
import { History, StickyNote, LoaderCircle } from "lucide-react";
export function DifficultyBadge({
  difficulty,
  className = "",
}: {
  difficulty: string | null;
  className?: string;
}) {
  const kind = ["easy", "medium", "hard"].includes(difficulty ?? "")
    ? difficulty!
    : "unrated";
  return (
    <span className={"prep-difficulty-badge " + kind + " " + className}>
      {kind[0].toUpperCase() + kind.slice(1)}
    </span>
  );
}
export function TopicTags({
  topics,
}: {
  topics: { slug: string; name: string }[];
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? topics : topics.slice(0, 3);
  return (
    <div className="prep-topic-tags">
      {shown.map((t) => (
        <span className="prep-topic-tag" key={t.slug}>
          {t.name}
        </span>
      ))}
      {!topics.length && <span className="prep-muted">Not available</span>}
      {topics.length > 3 && (
        <button
          type="button"
          className="prep-topic-more"
          aria-expanded={expanded}
          aria-label={
            expanded
              ? "Show fewer topics"
              : "Show " + (topics.length - 3) + " more topics"
          }
          title={
            expanded
              ? "Show fewer topics"
              : topics
                  .slice(3)
                  .map((t) => t.name)
                  .join(", ")
          }
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Less" : "+" + (topics.length - 3)}
        </button>
      )}
    </div>
  );
}
const ratings: Record<number, { label: string; color: string }> = {
  1: { label: "Struggled", color: "#f87171" },
  2: { label: "Tough", color: "#fb923c" },
  3: { label: "Got it", color: "#facc15" },
  4: { label: "Nailed it", color: "#4ade80" },
};
export function RevisionButton({
  questionTitle,
  confidence,
  scheduled,
  onClick,
}: {
  questionTitle: string;
  confidence: number | null;
  scheduled: boolean;
  onClick: () => void;
}) {
  const rating = confidence == null ? null : ratings[confidence];
  const recorded = Boolean(rating);
  const state = recorded ? "recorded" : scheduled ? "scheduled" : "empty";
  return (
    <button
      type="button"
      className="prep-question-icon"
      data-state={state}
      data-confidence={confidence ?? undefined}
      style={
        {
          "--action-color":
            rating?.color ?? (scheduled ? "#a7f3d0" : "#a1a1aa"),
        } as CSSProperties
      }
      aria-label={"Revision: " + questionTitle}
      aria-haspopup="dialog"
      title={
        "Revision: " +
        (rating?.label ?? (scheduled ? "Scheduled" : "Not recorded"))
      }
      onClick={onClick}
    >
      <History size={18} aria-hidden="true" />
      {state !== "empty" && (
        <span className="prep-action-marker" aria-hidden="true" />
      )}
    </button>
  );
}
export function NoteButton({
  questionTitle,
  filled,
  open,
  busy,
  disabled,
  controls,
  onClick,
}: {
  questionTitle: string;
  filled: boolean;
  open: boolean;
  busy?: boolean;
  disabled?: boolean;
  controls: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="prep-question-icon"
      data-state={filled ? "filled" : "empty"}
      style={
        { "--action-color": filled ? "#93c5fd" : "#a1a1aa" } as CSSProperties
      }
      aria-label={"Notes for " + questionTitle}
      title={filled ? "View or edit saved note" : "Add a private note"}
      aria-expanded={open}
      aria-controls={controls}
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      onClick={onClick}
    >
      {busy ? (
        <LoaderCircle
          size={18}
          className="prep-icon-spinner"
          aria-hidden="true"
        />
      ) : (
        <StickyNote size={18} aria-hidden="true" />
      )}
      {filled && <span className="prep-action-marker" aria-hidden="true" />}
    </button>
  );
}
