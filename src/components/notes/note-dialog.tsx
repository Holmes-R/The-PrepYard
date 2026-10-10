"use client";
import { useEffect, useId, useRef } from "react";
import { NoteEditor } from "./note-editor";
export function NoteDialog({
  questionId,
  title,
  content,
  tags,
  onClose,
}: {
  questionId: string;
  title: string;
  content: string;
  tags: string[];
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => {
      node?.close();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="prep-note-dialog"
      aria-labelledby={heading}
      onCancel={() => onClose()}
    >
      <h2 id={heading}>{title}</h2>
      <NoteEditor
        questionId={questionId}
        initialContent={content}
        initialTags={tags}
        onClose={onClose}
      />
    </dialog>
  );
}
