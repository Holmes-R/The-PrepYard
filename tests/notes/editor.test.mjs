import test from "node:test";
import assert from "node:assert/strict";
import {
  noteBlocks,
  insertCode,
  draftKey,
  readDraft,
  writeDraft,
  clearDraft,
  createNoteSaveController,
} from "../../src/features/notes/editor.mjs";
const tick = (ms = 15) => new Promise((r) => setTimeout(r, ms));
test("code fences preserve existing text and literal HTML", () => {
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
test("typing never saves; only explicit saves write a snapshot", async () => {
  const writes = [],
    statuses = [];
  let release;
  const controller = createNoteSaveController({
    status: (s) => statuses.push(s),
    save: async (value) => {
      writes.push(value);
      if (writes.length === 1)
        await new Promise((r) => {
          release = r;
        });
    },
  });
  controller.update("first");
  await tick(1200);
  assert.deepEqual(writes, []);
  assert.equal(statuses.at(-1), "unsaved");
  const request = controller.submit();
  controller.update("newer typing");
  assert.equal(
    await controller.submit(),
    false,
    "duplicate save cannot start another request",
  );
  release();
  assert.equal(await request, true);
  await tick();
  assert.deepEqual(writes, ["first"], "typing during a save remains a draft");
  assert.equal(statuses.at(-1), "unsaved");
  assert.equal(await controller.submit(), true);
  assert.deepEqual(writes, ["first", "newer typing"]);
  assert.equal(statuses.at(-1), "saved");
  assert.equal(await controller.submit(), true);
  assert.equal(writes.length, 2);
  controller.dispose();
});
test("failed saves can be retried explicitly; closing never writes a draft", async () => {
  let fail = true,
    count = 0;
  const states = [];
  const controller = createNoteSaveController({
    status: (s) => states.push(s),
    save: async () => {
      count++;
      if (fail) throw Error("Offline");
    },
  });
  controller.update("recover me");
  assert.equal(await controller.submit(), false);
  assert.equal(states.at(-1), "error");
  await tick();
  assert.equal(count, 1);
  fail = false;
  assert.equal(await controller.submit(), true);
  assert.equal(states.at(-1), "saved");
  controller.update("do not send after close");
  controller.dispose();
  await tick();
  assert.equal(await controller.submit(), false);
  assert.equal(count, 2);
});
