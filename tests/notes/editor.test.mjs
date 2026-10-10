import test from "node:test";
import assert from "node:assert/strict";
import {
  noteBlocks,
  noteTemplate,
  insertCode,
  draftKey,
  readDraft,
  writeDraft,
  clearDraft,
  createNoteAutosave,
} from "../../src/features/notes/editor.mjs";
const tick = (ms = 15) => new Promise((r) => setTimeout(r, ms));
test("templates and code fences preserve existing text and literal HTML", () => {
  assert.match(noteTemplate("approach"), /## Complexity/);
  assert.equal(noteTemplate("unknown"), "");
  const inserted = insertCode('keep\nreturn "```";', 5, 18, "python");
  assert.ok(inserted.content.startsWith("keep\n````python\n"));
  const blocks = noteBlocks(
    '## Approach\n\n<script>alert(1)</script>\n- edge\n\n```python\nprint("<div>")\n```',
  );
  assert.deepEqual(blocks, [
    { kind: "heading", level: 2, text: "Approach" },
    { kind: "text", text: "<script>alert(1)</script>" },
    { kind: "list", items: ["edge"] },
    { kind: "code", language: "python", text: 'print("<div>")' },
  ]);
  assert.deepEqual(noteBlocks("```sql\nselect 1"), [
    { kind: "code", language: "sql", text: "select 1" },
  ]);
});
test("drafts are account/question scoped; late saves cannot erase newer edits", () => {
  const map = new Map();
  const storage = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
  const key = draftKey("owner", "question");
  writeDraft(storage, key, "first", "saved");
  assert.equal(readDraft(storage, draftKey("other", "question")), null);
  assert.equal(readDraft(storage, draftKey("owner", "other")), null);
  writeDraft(storage, key, "newer", "saved");
  clearDraft(storage, key, "first");
  assert.equal(readDraft(storage, key).content, "newer");
  clearDraft(storage, key, " newer ");
  assert.equal(readDraft(storage, key), null);
  storage.setItem(key, "{broken");
  assert.equal(readDraft(storage, key), null);
});
test("autosave debounces, serializes in-flight edits, and flushes the newest value", async () => {
  const writes = [],
    statuses = [];
  let release;
  const queue = createNoteAutosave({
    delay: 5,
    status: (s) => statuses.push(s),
    save: async (value) => {
      writes.push(value);
      if (writes.length === 1) await new Promise((r) => (release = r));
    },
  });
  queue.schedule("discarded keystroke");
  queue.schedule("first");
  await tick();
  assert.deepEqual(writes, ["first"]);
  queue.schedule("second");
  queue.schedule("latest");
  const flushed = queue.flush();
  release();
  assert.equal(await flushed, true);
  assert.deepEqual(writes, ["first", "latest"]);
  assert.equal(statuses.at(-1), "saved");
  assert.equal(await queue.flush(), true);
  assert.equal(writes.length, 2);
  queue.dispose();
});
test("failed saves retain unsaved content for retry; disposing cancels a scheduled write", async () => {
  let fail = true,
    count = 0;
  const states = [];
  const queue = createNoteAutosave({
    delay: 5,
    status: (s) => states.push(s),
    save: async () => {
      count++;
      if (fail) throw Error("Offline");
    },
  });
  queue.schedule("recover me");
  assert.equal(await queue.flush(), false);
  assert.equal(states.at(-1), "error");
  fail = false;
  assert.equal(await queue.flush(), true);
  assert.equal(states.at(-1), "saved");
  queue.schedule("do not send after unmount");
  queue.dispose();
  await tick();
  assert.equal(count, 2);
});
