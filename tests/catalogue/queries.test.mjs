import test from "node:test";
import assert from "node:assert/strict";
import {
  companySheet,
  filtersFrom,
} from "../../src/features/catalogue/queries.mjs";

// Returns a client that records every statement and answers with the shape
// companySheet expects for each query in order.
const recordingClient = (calls) => ({
  query: async (sql, args) => {
    calls.push({ sql, args: [...args] });
    if (/from public\.companies c where c\.slug=\$1/.test(sql))
      return {
        rows: [
          {
            id: "c0000000-0000-4000-8000-000000000001",
            slug: "acme",
            name: "Acme",
          },
        ],
      };
    if (sql.startsWith("select distinct time_window"))
      return { rows: [{ time_window: "all" }] };
    if (sql.includes("as uses")) return { rows: [] };
    if (sql.includes("as total")) return { rows: [{ total: "3" }] };
    if (/^select count\(\*\) as n /.test(sql)) return { rows: [{ n: "2" }] };
    return { rows: [] };
  },
});

const placeholderCount = (sql) =>
  new Set([...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]))).size;

test("default filters never emit a dangling where or comments inside SQL", async () => {
  // The exact request that used to 503: no filter selected at all.
  const filters = filtersFrom({
    window: "all",
    sort: "frequency-desc",
    progress: "any",
    page: "1",
  });
  const calls = [];
  const sheet = await companySheet(recordingClient(calls), "acme", filters);
  assert.equal(sheet.total, 3);
  assert.ok(calls.length >= 6);
  for (const { sql } of calls) {
    assert.ok(
      !/\bwhere\s*$/i.test(sql),
      "statement ends in a bare where: …" + sql.slice(-90),
    );
    assert.ok(
      !/\bwhere\s+order\s+by/i.test(sql),
      "where with no conditions before order by: …" + sql.slice(-90),
    );
    assert.ok(
      !sql.includes("//"),
      "// written inside a SQL string is not a comment: …" +
        sql.slice(Math.max(0, sql.indexOf("//") - 60), sql.indexOf("//") + 70),
    );
  }
});

test("selected filters still become bound conditions", async () => {
  const calls = [];
  await companySheet(
    recordingClient(calls),
    "acme",
    filtersFrom({
      difficulty: "easy",
      q: "two",
      progress: "solved",
      page: "2",
    }),
  );
  const total = calls.find((c) => c.sql.includes("as total"));
  assert.match(total.sql, /q\.difficulty=\$3/);
  assert.match(total.sql, /strpos\(lower\(q\.title\),lower\(\$4\)\)>0/);
  assert.match(total.sql, /u\.status='solved'/);
  assert.ok(!/\bwhere\s*$/i.test(total.sql));
});

test("every statement binds exactly as many parameters as it references", async () => {
  for (const params of [
    {},
    { difficulty: "medium", window: "90d" },
    { q: "graph", topics: ["arrays", "dp"], progress: "revision" },
    { minFrequency: "40", minAcceptance: "50", sort: "title", page: "5" },
  ]) {
    const calls = [];
    await companySheet(recordingClient(calls), "acme", filtersFrom(params));
    for (const call of calls)
      assert.equal(
        call.args.length,
        placeholderCount(call.sql),
        `parameter mismatch for ${JSON.stringify(params)}`,
      );
  }
});

test("filters bound input and fall back to documented defaults", () => {
  const filters = filtersFrom({
    q: "x".repeat(1000),
    difficulty: "expert",
    window: "forever",
    progress: "private",
    page: "-20",
    topics: "Array';drop table questions;--",
  });
  assert.equal(filters.q.length, 100);
  assert.equal(filters.difficulty, "");
  assert.equal(filters.window, "all");
  assert.equal(filters.progress, "any");
  assert.equal(filters.page, 1);
  assert.deepEqual(filters.topics, []);
  assert.equal(filters.minFrequency, null);
});
