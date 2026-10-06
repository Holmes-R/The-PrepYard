"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteNote } from "@/features/progress/actions";

// Two-step inline confirm: one tap stages, the second commits, so a stray tap
// never destroys a note. The card disappears once router.refresh() re-renders
// the server page without it.
export function DeleteNoteButton({
  questionId,
  title,
}: {
  questionId: string;
  title: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const cancel = () => {
    if (pending) return;
    setConfirming(false);
    setError("");
  };
  const confirm = () => {
    setError("");
    start(async () => {
      const result = await deleteNote(questionId);
      // Stay in the confirm state on failure so a transient error can be
      // retried instead of losing the user's place.
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  };

  return (
    <span
      className="note-delete-wrap"
      onKeyDown={(event) => {
        if (event.key === "Escape") cancel();
      }}
    >
      {confirming ? (
        <>
          <span className="note-delete-confirm">
            Delete this note?
            <span className="sr-only">: {title}</span>
          </span>
          <button
            type="button"
            className="note-delete-yes"
            disabled={pending}
            onClick={confirm}
            autoFocus
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
          <button
            type="button"
            className="note-delete-cancel"
            disabled={pending}
            onClick={cancel}
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          className="note-delete"
          disabled={pending}
          onClick={() => {
            setError("");
            setConfirming(true);
          }}
        >
          <Trash2 size={13} aria-hidden="true" />
          Delete note
        </button>
      )}
      {error && (
        <span className="note-delete-error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
