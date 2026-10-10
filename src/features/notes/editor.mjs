import { normalizeNoteTags } from "./model.mjs";
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
      [1, 2].includes(draft?.version) &&
      typeof draft.content === "string" &&
      draft.content.length <= NOTE_LIMIT &&
      typeof draft.base === "string" &&
      draft.base.length <= NOTE_LIMIT
    )
      return {
        ...draft,
        tags: normalizeNoteTags(draft.tags ?? []),
        baseTags: normalizeNoteTags(draft.baseTags ?? []),
      };
  } catch {
    /* Storage may be disabled or contain an incomplete draft. */
  }
  return null;
}
export function writeDraft(
  storage,
  key,
  content,
  base,
  tags = [],
  baseTags = [],
) {
  try {
    storage.setItem(
      key,
      JSON.stringify({ version: 2, content, base, tags, baseTags }),
    );
    return true;
  } catch {
    return false;
  }
}
export function clearDraft(storage, key, savedContent, savedTags) {
  try {
    const draft = readDraft(storage, key);
    // A late save must never erase a newer draft typed during that request.
    if (
      !draft ||
      savedContent === undefined ||
      (draft.content.trim() === savedContent.trim() &&
        (savedTags === undefined ||
          JSON.stringify(draft.tags) === JSON.stringify(savedTags)))
    )
      storage.removeItem(key);
  } catch {
    /* Saving on the server remains usable when browser storage fails. */
  }
}
// Editing only stages a draft. Only an explicit Save now writes a snapshot.
// Edits made during that request remain unsaved until another explicit save.
export function createNoteSaveController({
  initial = "",
  identify = (value) => value.trim(),
  save,
  status,
}) {
  let current = initial,
    saved = identify(initial),
    flight,
    disposed = false;
  return {
    update(value) {
      if (disposed) return;
      current = value;
      if (!flight) status(identify(current) === saved ? "saved" : "unsaved");
    },
    async submit() {
      if (disposed || flight) return false;
      if (identify(current) === saved) return true;
      const candidate = current;
      status("saving");
      flight = (async () => {
        try {
          await save(candidate);
          saved = identify(candidate);
          if (!disposed)
            status(identify(current) === saved ? "saved" : "unsaved");
          return true;
        } catch (error) {
          if (!disposed)
            status(
              "error",
              error?.message || "Could not save. Please try again.",
            );
          return false;
        }
      })();
      const result = await flight;
      flight = undefined;
      return result;
    },
    dispose() {
      disposed = true;
    },
  };
}
