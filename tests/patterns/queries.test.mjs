import test from "node:test";
import assert from "node:assert/strict";
import {
  patternFilters,
  patternQuestions,
} from "../../src/features/patterns/queries.mjs";
import { topicFor, topics } from "../../scripts/patterns/taxonomy.mjs";
import { readFile } from "node:fs/promises";
test("filters bound input and reject unsupported state", () => {
  const f = patternFilters({
    q: "x".repeat(1000),
    topic: "array';drop table questions;--",
    page: "-20",
    difficulty: "expert",
    progress: "private",
    sort: "q.id desc",
  });
  assert.equal(f.q.length, 100);
  assert.equal(f.topic, "");
  assert.equal(f.page, 1);
  assert.equal(f.difficulty, "");
  assert.equal(f.progress, "");
  assert.equal(f.sort, "recommended");
});
test("reference has 180 memberships and 178 canonical questions", async () => {
  const fixture = JSON.parse(
    await readFile(
      new URL("../../scripts/patterns/kushal-patterns.json", import.meta.url),
    ),
  );
  assert.equal(fixture.groups.flatMap((g) => g.questions).length, 180);
  assert.equal(new Set(fixture.groups.flatMap((g) => g.questions)).size, 178);
  assert.equal(
    fixture.groups.find((g) => g.name === "Prefix Sum").questions.length,
    5,
  );
});
test("DSA headings stay separate from patterns and topic classification is deterministic", () => {
  for (const forbidden of [
    "prefix-sum",
    "sliding-window",
    "two-pointers",
    "monotonic-stack",
  ])
    assert.ok(!topics.some(([s]) => s === forbidden));
  assert.equal(topicFor(["array", "matrix"]), "matrices");
  assert.equal(
    topicFor(["array", "string"], ["DP on Strings"]),
    "dynamic-programming",
  );
  assert.equal(topicFor(["array"], ["Union-Find"]), "graphs");
});
test("SQL binds filters, scopes student state and clamps pagination", async () => {
  const calls = [];
  const client = {
    query: async (sql, args) => {
      calls.push({ sql, args: [...args] });
      return { rows: calls.length === 1 ? [{ total: 2, solved: 1 }] : [] };
    },
  };
  const result = await patternQuestions(
    client,
    patternFilters({
      q: "x' OR 1=1--",
      pattern: "prefix-sum",
      collection: "kushal-essential-patterns",
      progress: "bookmarked",
      page: "99999",
    }),
  );
  assert.equal(result.page, 1);
  assert.equal(result.pages, 1);
  assert.ok(calls[0].args.includes("x' OR 1=1--"));
  assert.ok(!calls[0].sql.includes("x' OR 1=1--"));
  assert.match(calls[1].sql, /private.student_id\(\)/);
  assert.match(calls[1].sql, /qp.reviewed/);
  assert.equal(calls[1].args.at(-1), 0);
});
