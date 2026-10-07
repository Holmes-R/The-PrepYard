import test from "node:test";
import { createHash } from "node:crypto";
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
test("reference selections are complete, deduplicated and attributed", () => {
  const sheets = validateCollections(manifest);
  assert.deepEqual(
    Object.fromEntries(sheets.map((s) => [s.slug, s.questions.length])),
    {
      "interview-launchpad": 66,
      "dsa-deep-dive": 282,
    },
  );
  assert.equal(manifest.curation.origin, "referenced");
  assert.ok(
    sheets.every((s) =>
      s.referenceUrl.startsWith("https://codolio.com/question-tracker/sheet/"),
    ),
  );
  assert.equal(
    sheets[0].questions[0].url,
    "https://leetcode.com/problems/two-sum/",
  );
  const bad = structuredClone(manifest);
  bad.collections[0].slug = "neetcode-150";
  assert.throws(() => validateCollections(bad));
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
    patternFilters({ collection: "interview-launchpad" }),
  );
  assert.match(calls[1].sql, /order by.*pattern_collections/s);
  assert.equal(
    calls[1].args.filter((x) => x === "interview-launchpad").length,
    2,
  );
  assert.equal(calls[1].args.at(-1), 0);
});

test("pinned membership matches its provenance checksum and multi-platform scope", async () => {
  const provenance = JSON.parse(
    await readFile(
      new URL(
        "../../scripts/patterns/collection-provenance.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.deepEqual(
    provenance.map((p) => p.sourceRows),
    [70, 287],
  );
  for (const sheet of manifest.collections) {
    const entry = provenance.find((p) => p.slug === sheet.slug);
    assert.equal(entry.uniqueQuestions, sheet.expectedCount);
    assert.equal(
      createHash("sha256")
        .update(JSON.stringify(sheet.questions))
        .digest("hex"),
      entry.sha256,
    );
  }
  assert.deepEqual(
    [
      ...new Set(manifest.collections[1].questions.map((q) => q.platform)),
    ].sort(),
    ["geeksforgeeks", "leetcode", "spoj"],
  );
});
