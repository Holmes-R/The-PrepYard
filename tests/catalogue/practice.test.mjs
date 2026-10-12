import test from "node:test";
import assert from "node:assert/strict";
import {
  practiceQuestion,
  practiceNote,
  reviewedAlternatives,
  validateAlternatives,
} from "../../src/features/questions/practice.mjs";
import { decorateRoadmapQuestions } from "../../src/features/patterns/roadmap.mjs";
import {
  companySheet,
  filtersFrom,
} from "../../src/features/catalogue/queries.mjs";
import {
  patternQuestions,
  patternFilters,
} from "../../src/features/patterns/queries.mjs";

test("replacement preserves stable progress/note identity and never mutates input", () => {
  const input = {
    id: "stable",
    title: "Walls and Gates",
    canonical_url: "https://leetcode.com/problems/walls-and-gates/",
    status: "solved",
    revision_confidence: 2,
    has_note: true,
    frequency: 75,
    topics: [{ slug: "breadth-first-search", name: "BFS" }],
  };
  const result = practiceQuestion(input);
  assert.equal(result.title, "Islands and Treasure");
  assert.equal(result.platform, "NeetCode");
  assert.equal(
    result.canonical_url,
    "https://neetcode.io/problems/islands-and-treasure/question",
  );
  for (const key of [
    "id",
    "status",
    "revision_confidence",
    "has_note",
    "frequency",
    "topics",
  ])
    assert.deepEqual(result[key], input[key]);
  assert.equal(input.title, "Walls and Gates");
});
test("free questions are unchanged, unresolved paid questions are withheld", () => {
  const free = {
    id: "free",
    canonical_url: "https://leetcode.com/problems/two-sum",
  };
  assert.deepEqual(practiceQuestion(free), free);
  assert.equal(
    practiceQuestion({
      canonical_url: "https://leetcode.com/problems/robot-room-cleaner/",
    }),
    null,
  );
  // An identically named path on another judge is not a LeetCode identity.
  const other = {
    canonical_url: "https://example.com/problems/robot-room-cleaner/",
  };
  assert.deepEqual(practiceQuestion(other), other);
});
test("historical notes survive withholding, without a paid practice link", () => {
  const note = {
    id: "owner-note",
    canonical_url: "https://leetcode.com/problems/robot-room-cleaner",
    content: "Keep this",
    tags: ["Redo"],
  };
  assert.deepEqual(practiceNote(note), { ...note, canonical_url: "" });
  assert.equal(
    practiceNote({
      canonical_url: "https://leetcode.com/problems/meeting-rooms-ii",
    }).canonical_url,
    "https://www.geeksforgeeks.org/problems/attend-all-meetings-ii/1",
  );
});
test("curated memberships survive URL replacement and original URL is not returned", () => {
  const rows = decorateRoadmapQuestions([
    {
      canonical_url: "https://neetcode.io/problems/foreign-dictionary/question",
      original_url: "https://leetcode.com/problems/alien-dictionary/",
      patterns: [],
      topics: [],
    },
  ]);
  assert.ok(rows[0].patterns.some((p) => p.slug === "graphs"));
  assert.ok(!Object.hasOwn(rows[0], "original_url"));
});
test("publication rejects unreviewed, insecure, duplicate and non-judge destinations", () => {
  const valid = reviewedAlternatives[0];
  for (const patch of [
    { match: "similar" },
    { free_submission: false },
    { url: "javascript:alert(1)" },
    { url: "https://www.geeksforgeeks.org.evil.example/problems/foo/1" },
    { url: "https://www.geeksforgeeks.org/dsa/foo/" },
    { url: "https://user:password@www.geeksforgeeks.org/problems/foo/1" },
  ])
    assert.throws(() => validateAlternatives([{ ...valid, ...patch }]));
  assert.throws(() => validateAlternatives([valid, valid]));
});
test("company and pattern APIs return the same replacement without losing owner state", async () => {
  const replacement = {
    id: "stable",
    title: "Islands and Treasure",
    canonical_url: "https://neetcode.io/problems/islands-and-treasure/question",
    original_url: "https://leetcode.com/problems/walls-and-gates",
    platform: "NeetCode",
    difficulty: "medium",
    status: "solved",
    has_note: true,
    patterns: [],
    topics: [],
  };
  const calls = [];
  const client = {
    query: async (sql, args) => {
      calls.push({ sql, args: [...args] });
      if (sql.includes("select c.id,c.slug,c.name"))
        return {
          rows: [
            {
              id: "company",
              slug: "acme",
              name: "Acme",
              available: ["all"],
              topics: [],
            },
          ],
        };
      if (sql.startsWith("select distinct time_window"))
        return { rows: [{ time_window: "all" }] };
      if (sql.includes("as uses")) return { rows: [] };
      if (sql.startsWith("select count(*) as n")) return { rows: [{ n: 1 }] };
      if (sql.startsWith("with filtered"))
        return {
          rows: [
            {
              total: 1,
              solved: 1,
              easy_count: 0,
              medium_count: 1,
              hard_count: 0,
              page: 1,
              pages: 1,
              rows: [replacement],
            },
          ],
        };
      if (sql.startsWith("select count(*)"))
        return {
          rows: [
            {
              total: 1,
              solved: 1,
              easy_count: 0,
              medium_count: 1,
              hard_count: 0,
            },
          ],
        };
      return { rows: [replacement] };
    },
  };
  const company = await companySheet(
    client,
    "acme",
    filtersFrom({ q: "Treasure", difficulty: "medium", order: "title-asc" }),
  );
  const pattern = await patternQuestions(
    client,
    patternFilters({ q: "Treasure", difficulty: "medium", order: "title-asc" }),
  );
  assert.deepEqual(company.rows[0], pattern.rows[0]);
  assert.equal(company.rows[0].id, "stable");
  for (const { sql, args } of calls) {
    if (sql.includes("jsonb_to_recordset"))
      assert.match(sql, /alternative.url is not null/);
    const parameters = new Set([...sql.matchAll(/\$(\d+)/g)].map((m) => m[1]));
    assert.equal(parameters.size, args.length);
  }
});
