import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateCollections } from "../../scripts/patterns/collections.mjs";
import {
  patternFilters,
  patternQuestions,
} from "../../src/features/patterns/queries.mjs";
const manifest = JSON.parse(
  await readFile(
    new URL("../../scripts/patterns/collections.json", import.meta.url),
    "utf8",
  ),
);
test("verified sheets have exact unique question counts", () => {
  const sheets = validateCollections(manifest);
  assert.deepEqual(
    Object.fromEntries(sheets.map((s) => [s.slug, s.questions.length])),
    {
      "striver-sde": 177,
      "striver-a2z": 432,
      "neetcode-150": 150,
      "blind-75": 75,
    },
  );
  const a2z = sheets.find((s) => s.slug === "striver-a2z");
  assert.equal(a2z.excludedLearningItems, 47);
  assert.equal(a2z.practiceEntries, 448);
  const nc = new Set(
    sheets
      .find((s) => s.slug === "neetcode-150")
      .questions.map((q) => q.externalId),
  );
  assert.ok(
    sheets
      .find((s) => s.slug === "blind-75")
      .questions.every((q) => nc.has(q.externalId)),
  );
});
test("invalid counts, duplicate identities and external URLs fail closed", () => {
  for (const mutate of [
    (m) => m.collections[0].expectedCount++,
    (m) => (m.collections[0].questions[1] = m.collections[0].questions[0]),
    (m) =>
      (m.collections[0].questions[0].url =
        "https://example.com/problems/two-sum/"),
  ]) {
    const bad = structuredClone(manifest);
    mutate(bad);
    assert.throws(() => validateCollections(bad));
  }
});
test("recommended ordering uses the selected collection instead of unrelated sheets", async () => {
  const calls = [];
  const client = {
    query: async (sql, args) => {
      calls.push({ sql, args: [...args] });
      return { rows: calls.length === 1 ? [{ total: 150, solved: 0 }] : [] };
    },
  };
  await patternQuestions(
    client,
    patternFilters({ collection: "neetcode-150" }),
  );
  assert.match(calls[1].sql, /order by.*pattern_collections/s);
  assert.equal(calls[1].args.filter((x) => x === "neetcode-150").length, 2);
  assert.equal(calls[1].args.at(-1), 0);
});
