import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeNoteTags,
  parseNoteInput,
  noteSignature,
} from "../../src/features/notes/model.mjs";
import {
  createNoteSaveController,
  draftKey,
  readDraft,
  writeDraft,
  clearDraft,
} from "../../src/features/notes/editor.mjs";

test("custom tags are optional, trimmed, deduplicated and bounded", () => {
  assert.deepEqual(normalizeNoteTags([]), []);
  assert.deepEqual(
    normalizeNoteTags([
      " Review  later ",
      "review later",
      "Edge cases",
      "தமிழ்",
    ]),
    ["Review later", "Edge cases", "தமிழ்"],
  );
  for (const tags of [
    null,
    "Review",
    [""],
    ["\nReview"],
    ["a".repeat(33)],
    [null],
    Array.from({ length: 9 }, (_, i) => "Tag " + i),
  ])
    assert.throws(() => normalizeNoteTags(tags));
  assert.deepEqual(parseNoteInput(" hello ", ["Review"]), {
    content: "hello",
    tags: ["Review"],
  });
  assert.throws(() => parseNoteInput("x".repeat(50001), []));
});
test("tag-only edits save with note text only on explicit submit", async () => {
  const writes = [];
  const queue = createNoteSaveController({
    initial: { content: "Keep this text", tags: [] },
    identify: noteSignature,
    status: () => {},
    save: async (value) => {
      writes.push(value);
    },
  });
  queue.update({ content: "Keep this text", tags: ["Review"] });
  assert.equal(writes.length, 0);
  assert.equal(await queue.submit(), true);
  queue.update({ content: "Keep this text", tags: [] });
  assert.equal(await queue.submit(), true);
  assert.deepEqual(
    writes.map((n) => n.tags),
    [["Review"], []],
  );
  assert.ok(writes.every((n) => n.content === "Keep this text"));
  queue.dispose();
});
test("tag drafts survive refresh; a text save cannot erase newer tag changes", () => {
  const data = new Map(),
    storage = {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => data.set(k, v),
      removeItem: (k) => data.delete(k),
    };
  const key = draftKey("owner", "question");
  writeDraft(storage, key, "same text", "same text", ["New tag"], ["Old tag"]);
  assert.deepEqual(readDraft(storage, key).tags, ["New tag"]);
  clearDraft(storage, key, "same text", ["Old tag"]);
  assert.ok(readDraft(storage, key));
  clearDraft(storage, key, "same text", ["New tag"]);
  assert.equal(readDraft(storage, key), null);
  storage.setItem(
    key,
    JSON.stringify({ version: 1, content: "Old draft", base: "Saved" }),
  );
  assert.deepEqual(readDraft(storage, key).tags, []);
  writeDraft(storage, key, '"'.repeat(50000), "saved", ["Review"], []);
  assert.equal(readDraft(storage, key).content.length, 50000);
});
