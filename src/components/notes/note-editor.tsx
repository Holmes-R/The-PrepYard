"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useClientSession } from "@/components/auth/client-session";
import { Button } from "@/components/ui/button";
import { saveNote } from "@/features/notes/actions";
import { X } from "lucide-react";
import {
  normalizeNoteTags,
  noteSignature,
  MAX_NOTE_TAGS,
  MAX_TAG_LENGTH,
  type EditableNote,
} from "@/features/notes/model.mjs";
import { refreshClientData } from "@/lib/client/use-client-resource";
import { NoteContent } from "./note-content";
import {
  NOTE_LIMIT,
  NOTE_LANGUAGES,
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
  initialTags = [],
  onSaved,
  onClose,
}: {
  questionId: string;
  initialContent: string;
  initialTags?: string[];
  onSaved?: (content: string, tags: string[]) => Promise<void> | void;
  onClose: () => void;
}) {
  const { user } = useClientSession();
  const id = useId();
  const [content, setContent] = useState(initialContent);
  const [tags, setTags] = useState(initialTags);
  const [tagInput, setTagInput] = useState("");
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const [language, setLanguage] = useState("python");
  const [recovery, setRecovery] = useState<NoteDraft | null>(null);
  const [storageWarning, setStorageWarning] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const queue = useRef<NoteAutosave<EditableNote> | null>(null);
  const base = useRef({ content: initialContent, tags: initialTags });
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
        if (draft && noteSignature(draft) !== noteSignature(base.current))
          setRecovery(draft);
        else clearDraft(sessionStorage, key);
      } catch {
        setStorageWarning(true);
      }
    });
    const autosave = createNoteAutosave({
      initial: base.current,
      identify: noteSignature,
      save: async (value) => {
        const result = await saveNote(questionId, value.content, value.tags);
        if (!result.ok) throw new Error(result.message);
        base.current = { content: value.content.trim(), tags: value.tags };
        try {
          clearDraft(sessionStorage, key, value.content, value.tags);
        } catch {
          /* Browser storage is optional. */
        }
        refreshClientData();
        // The question row can remain visible after its editor is hidden.
        // Refresh it even when this editor unmounted during the request.
        try {
          await callbacks.current.onSaved?.(value.content.trim(), value.tags);
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
  function change(value: string, nextTags = tags) {
    if (value.length > NOTE_LIMIT) {
      setError("Notes can contain up to 50,000 characters.");
      return;
    }
    setContent(value);
    setTags(nextTags);
    if (key) {
      try {
        if (
          !writeDraft(
            sessionStorage,
            key,
            value,
            base.current.content,
            nextTags,
            base.current.tags,
          )
        )
          setStorageWarning(true);
      } catch {
        setStorageWarning(true);
      }
    }
    queue.current?.schedule({ content: value, tags: nextTags });
  }
  async function flush(close = false) {
    if (await queue.current?.flush()) {
      if (close) callbacks.current.onClose();
    }
  }
  function addTag() {
    if (!tagInput.trim()) return;
    try {
      const next = normalizeNoteTags([...tags, tagInput]);
      if (next.length === tags.length) {
        setError("This tag is already added.");
        return;
      }
      change(content, next);
      setTagInput("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Invalid tag.");
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
            {noteSignature({
              content: recovery.base,
              tags: recovery.baseTags,
            }) !== noteSignature({ content: initialContent, tags: initialTags })
              ? " The saved note has changed since this draft was started."
              : ""}
          </p>
          <Button
            type="button"
            size="compact"
            onClick={() => {
              const draft = recovery;
              setRecovery(null);
              change(draft.content, draft.tags);
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
      <div className="prep-note-tag-field">
        <label htmlFor={id + "-tag"}>
          Tags <span>(optional)</span>
        </label>
        {tags.length > 0 && (
          <ul className="prep-note-tags" aria-label="Your note tags">
            {tags.map((tag, index) => (
              <li key={tag}>
                <span>{tag}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="compact"
                  aria-label={"Remove tag " + tag}
                  disabled={!!recovery || !key}
                  onClick={() =>
                    change(
                      content,
                      tags.filter((_, i) => i !== index),
                    )
                  }
                >
                  <X size={13} aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="prep-note-tag-input">
          <input
            id={id + "-tag"}
            value={tagInput}
            maxLength={MAX_TAG_LENGTH}
            placeholder="e.g. Edge cases"
            disabled={!!recovery || !key || tags.length >= MAX_NOTE_TAGS}
            onChange={(event) => setTagInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addTag();
              }
            }}
            aria-describedby={id + "-tag-help"}
          />
          <Button
            type="button"
            size="compact"
            variant="secondary"
            disabled={
              !!recovery ||
              !key ||
              !tagInput.trim() ||
              tags.length >= MAX_NOTE_TAGS
            }
            onClick={addTag}
          >
            Add tag
          </Button>
        </div>
        <p id={id + "-tag-help"} className="prep-note-hint">
          Your own labels · Up to 8 tags · Press Enter or Add tag.
        </p>
      </div>
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
