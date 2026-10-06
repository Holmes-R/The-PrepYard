"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { X } from "lucide-react";
import { getRevisionHistory, saveRevision } from "@/features/progress/actions";

const CONFIDENCE = [
  { value: 1, label: "Struggled", hint: "Need to redo this", color: "#f87171" },
  { value: 2, label: "Tough", hint: "Solved with effort", color: "#fb923c" },
  { value: 3, label: "Got it", hint: "Needed a hint", color: "#facc15" },
  {
    value: 4,
    label: "Nailed it",
    hint: "Clean & quick solve",
    color: "#4ade80",
  },
] as const;

function formatDate(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

export function RevisionDialog({
  questionId,
  questionTitle,
  open,
  onClose,
  onDone,
}: {
  questionId: string;
  questionTitle: string;
  open: boolean;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<"add" | "history">("add");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<
    { id: string; occurred_at: string; confidence: number | null }[] | null
  >(null);
  const [historyError, setHistoryError] = useState("");
  const titleId = "revision-title-" + questionId;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    }
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  if (!open) return null;

  const openHistory = () => {
    setTab("history");
    if (history !== null) return;
    setHistoryError("");
    getRevisionHistory(questionId)
      .then((result) => {
        if (result.ok) setHistory(result.entries);
        else setHistoryError(result.message);
      })
      .catch(() =>
        setHistoryError("Could not load history. Please try again."),
      );
  };
  const submit = () => {
    if (confidence === null || pending) return;
    start(async () => {
      setMessage("");
      let result;
      try {
        result = await saveRevision(questionId, confidence);
      } catch {
        setMessage("Could not save. Please try again.");
        return;
      }
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      await onDone();
      onClose();
    });
  };

  return (
    <dialog
      ref={dialogRef}
      className="dsa-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        if (pending) event.preventDefault();
        else onClose();
      }}
    >
      <div className="dsa-dialog-head">
        <div role="tablist" aria-label={"Revision for " + questionTitle}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "add"}
            className={tab === "add" ? "is-active" : ""}
            onClick={() => setTab("add")}
          >
            Add Revision
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "history"}
            className={tab === "history" ? "is-active" : ""}
            onClick={openHistory}
          >
            History
          </button>
        </div>
        <button
          type="button"
          className="dsa-dialog-close"
          aria-label="Close revision dialog"
          disabled={pending}
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      {tab === "add" ? (
        <div role="tabpanel">
          <h3 id={titleId} className="dsa-dialog-title">
            Rate your confidence
          </h3>
          <p className="prep-revision-question">{questionTitle}</p>
          <div
            className="dsa-confidence"
            role="radiogroup"
            aria-label="Confidence level"
          >
            {CONFIDENCE.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={confidence === option.value}
                className={
                  "dsa-confidence-option" +
                  (confidence === option.value ? " is-selected" : "")
                }
                tabIndex={
                  confidence === option.value ||
                  (confidence === null && option.value === 1)
                    ? 0
                    : -1
                }
                onKeyDown={(event) => {
                  if (
                    ![
                      "ArrowDown",
                      "ArrowRight",
                      "ArrowUp",
                      "ArrowLeft",
                    ].includes(event.key)
                  )
                    return;
                  event.preventDefault();
                  const next =
                    (option.value -
                      1 +
                      (["ArrowDown", "ArrowRight"].includes(event.key)
                        ? 1
                        : 3)) %
                    4;
                  setConfidence(next + 1);
                  event.currentTarget.parentElement
                    ?.querySelectorAll<HTMLButtonElement>("button")
                    [next]?.focus();
                }}
                onClick={() => setConfidence(option.value)}
              >
                <span
                  className="dsa-confidence-label"
                  style={{ color: option.color }}
                >
                  {option.label}
                </span>
                <span className="dsa-confidence-hint">{option.hint}</span>
              </button>
            ))}
          </div>
          {message && (
            <p className="dsa-dialog-error" role="alert">
              {message}
            </p>
          )}
          <button
            type="button"
            className="dsa-dialog-submit"
            disabled={confidence === null || pending}
            aria-busy={pending || undefined}
            onClick={submit}
          >
            {pending ? "Saving…" : "Mark as Revised"}
          </button>
        </div>
      ) : (
        <div role="tabpanel">
          <h3 id={titleId} className="dsa-dialog-title">
            Revision history
          </h3>
          {historyError ? (
            <p className="dsa-dialog-error" role="alert">
              {historyError}{" "}
              <button type="button" onClick={openHistory}>
                Try again
              </button>
            </p>
          ) : history === null ? (
            <p className="dsa-dialog-muted" role="status">
              Loading history…
            </p>
          ) : history.length === 0 ? (
            <p className="dsa-dialog-muted">
              No revisions yet. Rate your confidence to log the first one.
            </p>
          ) : (
            <ul className="dsa-history-list">
              {history.map((entry) => (
                <li key={entry.id}>
                  <strong
                    style={{
                      color: CONFIDENCE.find(
                        (option) => option.value === entry.confidence,
                      )?.color,
                    }}
                  >
                    {CONFIDENCE.find(
                      (option) => option.value === entry.confidence,
                    )?.label ?? "Rating not recorded"}
                  </strong>
                  <time dateTime={entry.occurred_at}>
                    {formatDate(entry.occurred_at)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </dialog>
  );
}
