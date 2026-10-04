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
  // Frequency is a company-reporting metric and was removed from the sheet.
  assert.ok(!/company_question_observations/.test(calls[1].sql));
});
test("search matches topic names as well as question titles", async () => {
  const calls = [];
  const client = {
    query: async (sql, args) => {
      calls.push({ sql, args: [...args] });
      return { rows: calls.length === 1 ? [{ total: 0, solved: 0 }] : [] };
    },
  };
  await patternQuestions(client, patternFilters({ q: "graphs" }));
  // An exists() rather than a second join: a question has one primary topic, so
  // matching on any topic's name through a join would duplicate rows.
  assert.match(
    calls[1].sql,
    /exists\(select 1 from public.question_dsa_topics/,
  );
  assert.match(calls[1].sql, /strpos\(lower\(t2\.name\)/);
  assert.ok(!calls[1].sql.includes("'graphs'"));
  assert.ok(calls[1].args.includes("graphs"));
});
test("shuffle is allowlisted and orders randomly", async () => {
  assert.equal(patternFilters({ sort: "random" }).sort, "random");
  const calls = [];
  const client = {
    query: async (sql, args) => {
      calls.push({ sql, args: [...args] });
      return { rows: calls.length === 1 ? [{ total: 0, solved: 0 }] : [] };
    },
  };
  await patternQuestions(client, patternFilters({ sort: "random" }));
  assert.match(calls[1].sql, /order by random\(\)/);
});
test("removed progress states and orderings fall back instead of matching", () => {
  // Needs revision and the title/difficulty orderings have no control left.
  assert.equal(patternFilters({ progress: "revision" }).progress, "");
  assert.equal(patternFilters({ sort: "title" }).sort, "recommended");
  assert.equal(patternFilters({ sort: "difficulty" }).sort, "recommended");
});
test("every statement binds exactly as many parameters as it references", async () => {
  // A bind list longer than the statement needs is a runtime error, and it is easy
  // to introduce when a clause is built unconditionally but only used in one branch.
  const placeholderCount = (sql) =>
    new Set([...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]))).size;
  for (const params of [
    { sort: "random", collection: "neetcode-150" },
    { sort: "random" },
    { collection: "neetcode-150" },
    { q: "graph", difficulty: "hard", progress: "bookmarked" },
  ]) {
    const calls = [];
    const client = {
      query: async (sql, args) => {
        calls.push({ sql, args: [...args] });
        return { rows: calls.length === 1 ? [{ total: 0, solved: 0 }] : [] };
      },
    };
    await patternQuestions(client, patternFilters(params));
    for (const call of calls)
      assert.equal(
        call.args.length,
        placeholderCount(call.sql),
        `parameter mismatch for ${JSON.stringify(params)}`,
      );
  }
});
test("hide topics is a two-state view preference", () => {
  assert.equal(patternFilters({}).hideTopics, "");
  assert.equal(patternFilters({ hideTopics: "1" }).hideTopics, "1");
  assert.equal(patternFilters({ hideTopics: "yes" }).hideTopics, "");
  assert.equal(patternFilters({ hideTopics: ["1"] }).hideTopics, "");
});
