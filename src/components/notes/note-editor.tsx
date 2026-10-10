"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useClientSession } from "@/components/auth/client-session";
import { Button } from "@/components/ui/button";
import { saveQuestionProgress } from "@/features/progress/actions";
import { refreshClientData } from "@/lib/client/use-client-resource";
import { NoteContent } from "./note-content";
import {
  NOTE_LIMIT,
  NOTE_LANGUAGES,
  noteTemplate,
  insertCode,
  draftKey,
  readDraft,
  writeDraft,
  clearDraft,
  createNoteAutosave,
  type NoteAutosave,
  type NoteDraft,
  type SaveStatus,
} from "@/features/notes/editor.mjs";

export function NoteEditor({
  questionId,
  initialContent,
  onSaved,
  onClose,
}: {
  questionId: string;
  initialContent: string;
  onSaved?: (content: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const { user } = useClientSession();
  const id = useId();
  const [content, setContent] = useState(initialContent);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const [language, setLanguage] = useState("python");
  const [recovery, setRecovery] = useState<NoteDraft | null>(null);
  const [storageWarning, setStorageWarning] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const queue = useRef<NoteAutosave | null>(null);
  const base = useRef(initialContent);
  const callbacks = useRef({ onSaved, onClose });
  const key = user?.id ? draftKey(user.id, questionId) : "";
  useEffect(() => {
    callbacks.current = { onSaved, onClose };
  }, [onSaved, onClose]);
  useEffect(() => {
    if (!key) return;
    let mounted = true;
    // Load tab-local storage after hydration without reading it during render.
    void Promise.resolve().then(() => {
      if (!mounted) return;
      try {
        const draft = readDraft(sessionStorage, key);
        if (draft && draft.content.trim() !== base.current.trim())
          setRecovery(draft);
        else clearDraft(sessionStorage, key);
      } catch {
        setStorageWarning(true);
      }
    });
    const autosave = createNoteAutosave({
      initial: base.current,
      save: async (value) => {
        const result = await saveQuestionProgress(questionId, "note", value);
        if (!result.ok) throw new Error(result.message);
        base.current = value.trim();
        try {
          clearDraft(sessionStorage, key, value);
        } catch {
          /* Browser storage is optional. */
        }
        refreshClientData();
        // The question row can remain visible after its editor is hidden.
        // Refresh it even when this editor unmounted during the request.
        try {
          await callbacks.current.onSaved?.(value.trim());
        } catch {
          /* The save succeeded even if a list refresh failed. */
        }
      },
      status: (next, message = "") => {
        if (mounted) {
          setStatus(next);
          setError(message);
        }
      },
    });
    queue.current = autosave;
    return () => {
      mounted = false;
      autosave.dispose();
      queue.current = null;
    };
  }, [key, questionId]);
  function change(value: string) {
    if (value.length > NOTE_LIMIT) {
      setError("Notes can contain up to 50,000 characters.");
      return;
    }
    setContent(value);
    if (key) {
      try {
        if (!writeDraft(sessionStorage, key, value, base.current))
          setStorageWarning(true);
      } catch {
        setStorageWarning(true);
      }
    }
    queue.current?.schedule(value);
  }
  async function flush(close = false) {
    if (await queue.current?.flush()) {
      if (close) callbacks.current.onClose();
    }
  }
  function addCode() {
    const start = input.current?.selectionStart ?? content.length;
    const end = input.current?.selectionEnd ?? start;
    const next = insertCode(content, start, end, language);
    if (next.content.length > NOTE_LIMIT) {
      setError("There is not enough space for this code block.");
      return;
    }
    change(next.content);
    setPreview(false);
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(next.cursor, next.end);
    });
  }
  return (
    <section className="prep-note-editor" aria-label="Note editor">
      {recovery && (
        <div className="prep-note-recovery" role="status">
          <p>
            Unsaved draft found in this tab.
            {recovery.base.trim() !== initialContent.trim()
              ? " The saved note has changed since this draft was started."
              : ""}
          </p>
          <Button
            type="button"
            size="compact"
            onClick={() => {
              const draft = recovery;
              setRecovery(null);
              change(draft.content);
            }}
          >
            Restore draft
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="compact"
            onClick={() => {
              try {
                clearDraft(sessionStorage, key);
              } catch {
                /* Storage may be disabled. */
              }
              setRecovery(null);
            }}
          >
            Discard draft
          </Button>
        </div>
      )}
      <div className="prep-note-toolbar">
        <div role="group" aria-label="Editor mode">
          <Button
            type="button"
            size="compact"
            variant={preview ? "ghost" : "secondary"}
            aria-pressed={!preview}
            onClick={() => setPreview(false)}
          >
            Write
          </Button>
          <Button
            type="button"
            size="compact"
            variant={preview ? "secondary" : "ghost"}
            aria-pressed={preview}
            onClick={() => setPreview(true)}
          >
            Preview
          </Button>
        </div>
        <div className="prep-note-field">
          <label htmlFor={id + "-template"}>Template</label>
          <select
            id={id + "-template"}
            value=""
            disabled={!!recovery || !key}
            onChange={(event) => {
              const template = noteTemplate(event.target.value);
              if (template)
                change(content + (content.trim() ? "\n\n" : "") + template);
            }}
          >
            <option value="">Add template…</option>
            <option value="approach">Approach & complexity</option>
            <option value="mistakes">Mistakes & lessons</option>
          </select>
        </div>
        <div className="prep-note-field">
          <label htmlFor={id + "-language"}>Code language</label>
          <select
            id={id + "-language"}
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            {NOTE_LANGUAGES.map(([value, title]) => (
              <option value={value} key={value}>
                {title}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="compact"
          onClick={addCode}
          disabled={!!recovery || !key || preview}
        >
          Insert code
        </Button>
      </div>
      {preview ? (
        <NoteContent content={content} />
      ) : (
        <>
          <label className="sr-only" htmlFor={id + "-content"}>
            Your private notes
          </label>
          <textarea
            ref={input}
            id={id + "-content"}
            rows={9}
            maxLength={NOTE_LIMIT}
            value={content}
            onChange={(event) => change(event.target.value)}
            disabled={!!recovery || !key}
            placeholder="Your approach, edge cases, or a lesson to remember…"
          />
        </>
      )}
      <div className="prep-note-editor-footer">
        <span role="status" aria-live="polite">
          {status === "saving"
            ? "Saving…"
            : status === "unsaved"
              ? "Unsaved changes"
              : status === "error"
                ? "Not saved"
                : "Saved"}
        </span>
        <span className="prep-note-count">
          {content.length.toLocaleString()} / 50,000
        </span>
        <Button
          type="button"
          size="compact"
          loading={status === "saving"}
          disabled={!key || !!recovery}
          onClick={() => void flush()}
        >
          {status === "error" ? "Retry save" : "Save now"}
        </Button>
        <Button
          type="button"
          size="compact"
          variant="ghost"
          onClick={() => (recovery ? onClose() : void flush(true))}
        >
          Close
        </Button>
      </div>
      {error && (
        <p className="prep-note-error" role="alert">
          {error}
        </p>
      )}
      {storageWarning && (
        <p className="prep-note-error" role="status">
          Draft recovery is unavailable in this browser. Keep the editor open
          until it shows Saved.
        </p>
      )}
      <p className="prep-note-hint">
        Autosaves after you pause typing. Unsaved drafts can be recovered in
        this browser tab.
      </p>
    </section>
  );
}
