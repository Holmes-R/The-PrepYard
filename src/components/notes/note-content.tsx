"use client";
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { noteBlocks, NOTE_LANGUAGES } from "@/features/notes/editor.mjs";

function CodeBlock({ text, language }: { text: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setError("");
    } catch {
      setError("Copy is unavailable. Select the code to copy it manually.");
    }
  }
  return (
    <div className="prep-note-code">
      <div className="prep-note-code-head">
        <span>
          {NOTE_LANGUAGES.find(([id]) => id === language)?.[1] ?? language}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="compact"
          onClick={() => void copy()}
        >
          {copied ? (
            <Check size={14} aria-hidden="true" />
          ) : (
            <Copy size={14} aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy code"}
        </Button>
      </div>
      <pre>
        <code>{text}</code>
      </pre>
      {error && <p role="status">{error}</p>}
    </div>
  );
}
export function NoteContent({ content }: { content: string }) {
  const blocks = noteBlocks(content);
  return (
    <div className="prep-note-content">
      {blocks.length ? (
        blocks.map((block, index) => {
          if (block.kind === "code")
            return <CodeBlock key={index} {...block} />;
          if (block.kind === "heading")
            return <h3 key={index}>{block.text}</h3>;
          if (block.kind === "list")
            return (
              <ul key={index}>
                {block.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            );
          return <p key={index}>{block.text}</p>;
        })
      ) : (
        <p>No note content yet.</p>
      )}
    </div>
  );
}
