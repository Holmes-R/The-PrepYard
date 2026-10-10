export const NOTE_LIMIT = 50000;
export const NOTE_LANGUAGES = [
  ["text", "Plain text"],
  ["javascript", "JavaScript"],
  ["typescript", "TypeScript"],
  ["python", "Python"],
  ["java", "Java"],
  ["cpp", "C++"],
  ["c", "C"],
  ["go", "Go"],
  ["rust", "Rust"],
  ["sql", "SQL"],
];
export function noteTemplate(kind) {
  if (kind === "approach")
    return "## Approach\n\n## Why it works\n\n## Complexity\n\nTime: \nSpace: \n\n## Edge cases\n";
  if (kind === "mistakes")
    return "## What went wrong\n\n## Correction\n\n## What to remember\n";
  return "";
}
// This intentionally renders a small Markdown subset, never raw HTML.
export function noteBlocks(content) {
  const lines = content.replace(/\r\n?/g, "\n").split("\n"),
    blocks = [];
  for (let i = 0; i < lines.length;) {
    const fence = lines[i].match(/^(`{3,})([\w+-]*)[ \t]*$/);
    if (fence) {
      const code = [],
        size = fence[1].length;
      i++;
      while (
        i < lines.length &&
        !new RegExp("^`{" + size + ",}[ \\t]*$").test(lines[i])
      )
        code.push(lines[i++]);
      if (i < lines.length) i++;
      blocks.push({
        kind: "code",
        language: fence[2] || "text",
        text: code.join("\n"),
      });
    } else if (/^#{1,3} /.test(lines[i])) {
      const heading = lines[i++].match(/^(#{1,3}) (.*)$/);
      blocks.push({
        kind: "heading",
        level: heading[1].length,
        text: heading[2],
      });
    } else if (/^\s*- /.test(lines[i])) {
      const items = [];
      while (i < lines.length && /^\s*- /.test(lines[i]))
        items.push(lines[i++].replace(/^\s*- /, ""));
      blocks.push({ kind: "list", items });
    } else if (!lines[i].trim()) i++;
    else {
      const text = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^(`{3,}|#{1,3} |\s*- )/.test(lines[i])
      )
        text.push(lines[i++]);
      if (!text.length) text.push(lines[i++]);
      blocks.push({ kind: "text", text: text.join("\n") });
    }
  }
  return blocks;
}
export function insertCode(content, start, end, language) {
  const selected = content.slice(start, end);
  const longest = Math.max(
    2,
    ...[...selected.matchAll(/`+/g)].map((m) => m[0].length),
  );
  const fence = "`".repeat(longest + 1);
  const prefix =
    (start && content[start - 1] !== "\n" ? "\n" : "") +
    fence +
    language +
    "\n";
  const inserted = prefix + selected + "\n" + fence + "\n";
  return {
    content: content.slice(0, start) + inserted + content.slice(end),
    cursor: start + prefix.length,
    end: start + prefix.length + selected.length,
  };
}
export function draftKey(userId, questionId) {
  return "prepyard:note-draft:" + userId + ":" + questionId;
}
export function readDraft(storage, key) {
  try {
    const draft = JSON.parse(storage.getItem(key));
    if (
      draft?.version === 1 &&
      typeof draft.content === "string" &&
      draft.content.length <= NOTE_LIMIT &&
      typeof draft.base === "string" &&
      draft.base.length <= NOTE_LIMIT
    )
      return draft;
  } catch {
    /* Storage may be disabled or contain an incomplete draft. */
  }
  return null;
}
export function writeDraft(storage, key, content, base) {
  try {
    storage.setItem(key, JSON.stringify({ version: 1, content, base }));
    return true;
  } catch {
    return false;
  }
}
export function clearDraft(storage, key, savedContent) {
  try {
    const draft = readDraft(storage, key);
    // A late save must never erase a newer draft typed during that request.
    if (
      !draft ||
      savedContent === undefined ||
      draft.content.trim() === savedContent.trim()
    )
      storage.removeItem(key);
  } catch {
    /* Saving on the server remains usable when browser storage fails. */
  }
}
// One request at a time. Edits made during a save are coalesced, not sent out of
// order. Unmount cancels the debounce while an already-started save may finish.
export function createNoteAutosave({
  initial = "",
  save,
  status,
  delay = 1000,
}) {
  let current = initial,
    saved = initial.trim(),
    timer,
    flight,
    disposed = false,
    due = false;
  async function pump() {
    due = true;
    if (flight) return flight;
    flight = (async () => {
      while (!disposed && due && current.trim() !== saved) {
        due = false;
        const candidate = current;
        status("saving");
        try {
          await save(candidate);
          saved = candidate.trim();
        } catch (error) {
          due = false;
          status(
            "error",
            error?.message || "Could not save. Please try again.",
          );
          return false;
        }
        if (!disposed) status(current.trim() === saved ? "saved" : "unsaved");
      }
      return true;
    })();
    const result = await flight;
    flight = undefined;
    return result;
  }
  return {
    schedule(value) {
      if (disposed) return;
      current = value;
      clearTimeout(timer);
      status(current.trim() === saved && !flight ? "saved" : "unsaved");
      timer = setTimeout(() => {
        void pump();
      }, delay);
    },
    flush() {
      clearTimeout(timer);
      return disposed ? Promise.resolve(false) : pump();
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
    },
  };
}
