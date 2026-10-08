import test from "node:test";
import assert from "node:assert/strict";
import {
  roadmapChoices,
  roadmapPatterns,
  roadmapPattern,
  canonicalPatternSlug,
  roadmapPredicate,
  decorateRoadmapQuestions,
} from "../../src/features/patterns/roadmap.mjs";
import {
  patternQuestions,
  patternFilters,
  patternOverview,
} from "../../src/features/patterns/queries.mjs";
const expected = [
  "Fast and Slow Pointer",
  "Overlapping Intervals",
  "Prefix Sum",
  "Sliding Window",
  "Two Pointers",
  "Cyclic Sort (Index-Based)",
  "Reversal of Linked List (In-place)",
  "Matrix Manipulation",
  "Breadth First Search (BFS)",
  "Depth First Search (DFS)",
  "Backtracking",
  "Modified Binary Search",
  "Bitwise XOR",
  "Top 'K' Elements",
  "K-way Merge",
  "Two Heaps",
  "Monotonic Stack",
  "Trees",
  "Dynamic Programming",
  "Graphs",
  "Greedy",
  "Design Data Structure",
];
test("all 22 sections use the pinned reference order and complete exercise counts", () => {
  assert.deepEqual(
    roadmapChoices.map((p) => p.name),
    expected,
  );
  assert.deepEqual(
    roadmapChoices.map((p) => p.position),
    Array.from({ length: 22 }, (_, i) => i + 1),
  );
  assert.deepEqual(
    roadmapPatterns.map((p) => p.questions.length),
    [4, 5, 5, 13, 6, 4, 3, 4, 4, 5, 7, 9, 5, 4, 4, 3, 6, 32, 35, 9, 7, 6],
  );
  assert.equal(
    roadmapPatterns.reduce((n, p) => n + p.questions.length, 0),
    180,
  );
  assert.equal(new Set(roadmapChoices.map((p) => p.slug)).size, 22);
  for (const p of roadmapPatterns) {
    assert.ok(
      p.questions.every(
        (q) =>
          q.url.startsWith("https://leetcode.com/problems/") ||
          q.url.startsWith("https://www.geeksforgeeks.org/problems/"),
      ),
    );
    assert.equal(
      new Set(p.questions.map((q) => q.url)).size,
      p.questions.length,
    );
  }
});
test("specialized groups use explicit exercises while general groups use verified platform tags", () => {
  assert.equal(roadmapPattern("fast-and-slow-pointer").tags.length, 0);
  assert.ok(
    roadmapPattern("dynamic-programming").tags.includes("dynamic-programming"),
  );
  const question = {
    id: "stable",
    canonical_url: "https://leetcode.com/problems/find-the-duplicate-number/",
    topics: [{ slug: "two-pointers" }],
    patterns: [],
  };
  const result = decorateRoadmapQuestions([question])[0];
  assert.equal(result.id, "stable");
  assert.deepEqual(
    result.patterns.map((p) => p.name),
    ["Fast and Slow Pointer", "Two Pointers"],
  );
  assert.equal(canonicalPatternSlug("binary-search"), "modified-binary-search");
  assert.equal(canonicalPatternSlug("unknown"), "unknown");
});
test("a problem can belong to multiple roadmap sections without duplicate pattern tags", () => {
  const q = {
    canonical_url: "https://leetcode.com/problems/missing-number",
    topics: [],
    patterns: [
      { slug: "cyclic-sort-index-based", name: "Cyclic Sort (Index-Based)" },
    ],
  };
  assert.deepEqual(
    decorateRoadmapQuestions([q])[0].patterns.map((p) => p.name),
    ["Cyclic Sort (Index-Based)", "Bitwise XOR"],
  );
});
test("roadmap membership is parameterized and rejects unknown slugs", () => {
  const args = [],
    sql = roadmapPredicate("sliding-window", (v) => {
      args.push(v);
      return "$" + args.length;
    });
  assert.ok(!sql.includes("sliding-window"));
  assert.equal(args.length, 3);
  assert.equal(
    roadmapPredicate("x';drop table questions", () => {
      throw Error("Unexpected binding");
    }),
    "",
  );
});
test("overview keeps all groups even before database pattern rows are materialized", async () => {
  const client = { query: async () => ({ rows: [] }) };
  const result = await patternOverview(client, patternFilters());
  assert.deepEqual(result.patterns, roadmapChoices);
});
test("reference order yields to explicit sorts without unused SQL bindings", async () => {
  for (const extra of [
    {},
    { sort: "difficulty-desc" },
    { sort: "revision" },
    { sort: "random" },
    { order: "revision-asc,difficulty-desc" },
    { collection: "dsa-deep-dive" },
  ]) {
    const calls = [],
      client = {
        query: async (sql, args) => {
          calls.push({ sql, args: [...args] });
          return { rows: calls.length === 1 ? [{ total: 3, solved: 0 }] : [] };
        },
      };
    await patternQuestions(
      client,
      patternFilters({ pattern: "fast-and-slow-pointer", ...extra }),
    );
    for (const c of calls)
      assert.equal(
        c.args.length,
        new Set([...c.sql.matchAll(/\$(\d+)/g)].map((m) => m[1])).size,
      );
    if (!Object.keys(extra).length)
      assert.match(calls[1].sql, /array_position/);
    else assert.ok(!calls[1].sql.includes("array_position"));
  }
});
