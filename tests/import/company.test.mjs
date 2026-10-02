import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdtemp, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseCsv,
  parseCompanyCsv,
  loadCompanySnapshot,
} from "../../scripts/import/adapters/company-csv.mjs";
import { toStagingSql } from "../../scripts/import/publish/stage-sql.mjs";
const fixture = fileURLToPath(
  new URL("../fixtures/cs-satyam/1kosmos/", import.meta.url),
);
const manifestPath = path.join(fixture, "manifest.json");
const csv = await readFile(path.join(fixture, "all.csv"), "utf8");
const header = "ID,URL,Title,Difficulty,Acceptance %,Frequency %\n";
const row = "1,https://leetcode.com/problems/two-sum,Two Sum,Easy,50.0%,25.0%";
async function changedFixture(t, change) {
  const directory = await mkdtemp(path.join(tmpdir(), "prepyard-import-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await cp(fixture, directory, { recursive: true });
  const manifest = JSON.parse(
    await readFile(path.join(directory, "manifest.json"), "utf8"),
  );
  await change(directory, manifest);
  await writeFile(
    path.join(directory, "manifest.json"),
    JSON.stringify(manifest),
  );
  return path.join(directory, "manifest.json");
}
test("complete pinned fixture matches independently recorded expected values", async () => {
  const actual = await loadCompanySnapshot(manifestPath);
  const expected = JSON.parse(
    await readFile(path.join(fixture, "expected.json"), "utf8"),
  );
  assert.deepEqual(actual.questions, expected.questions);
  assert.deepEqual(actual.observations, expected.observations);
  assert.equal(
    actual.source.revision,
    "a09d3bae6ecf5420ae59e8886e0f9bf660717388",
  );
  assert.equal(actual.source.dataset_date, null);
  assert.equal(actual.source.company.name, "1Kosmos");
});
test("two windows share one stable question identity", async () => {
  const actual = await loadCompanySnapshot(manifestPath);
  assert.equal(actual.questions.length, 1);
  assert.equal(actual.observations.length, 2);
});
test("replaying a fixed fixture produces byte-identical staging artifacts", async () => {
  const a = await loadCompanySnapshot(manifestPath),
    b = await loadCompanySnapshot(manifestPath);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.equal(toStagingSql(a), toStagingSql(b));
});
test("CSV supports BOM, CRLF, quoted commas, escaped quotes and newlines", () => {
  assert.deepEqual(parseCsv('\uFEFFa,b\r\n"x,y","one ""quote""\nnext"\r\n'), [
    ["a", "b"],
    ["x,y", 'one "quote"\nnext'],
  ]);
});
test("quoted problem title preserves punctuation exactly", () => {
  const result = parseCompanyCsv(
    header +
      '1,https://leetcode.com/problems/two-sum,"Two, ""Sum""",Easy,50%,25%',
    "all.csv",
  );
  assert.equal(result[0].question.title, 'Two, "Sum"');
});
test("empty percentages stay unknown; zero is a real percentage", () => {
  const unknown = parseCompanyCsv(
    header + "1,https://leetcode.com/problems/two-sum,Two Sum,Easy,,",
    "all.csv",
  )[0];
  assert.equal(unknown.observation.frequency, null);
  assert.equal(unknown.observation.frequency_kind, "unknown");
  assert.equal(unknown.observation.acceptance_percent, null);
  assert.equal(
    parseCompanyCsv(header + row.replace("25.0%", "0%"), "all.csv")[0]
      .observation.frequency,
    0,
  );
});
test("URL normalization removes only a trailing slash", () => {
  assert.equal(
    parseCompanyCsv(
      header + row.replace("/two-sum,", "/two-sum/,"),
      "all.csv",
    )[0].question.canonical_url,
    "https://leetcode.com/problems/two-sum",
  );
});
for (const [label, input] of [
  ["empty file", ""],
  ["header-only file", header],
  ["wrong header", header.replace("Frequency %", "Frequency") + row],
  ["wrong columns", header + row + ",extra"],
  ["invalid ID", header + row.replace("1,", "01,")],
  ["invalid difficulty", header + row.replace("Easy", "Extreme")],
  ["invalid percentage", header + row.replace("25.0%", "125%")],
  ["invalid acceptance", header + row.replace("50.0%", "NaN%")],
  [
    "URL impersonation",
    header + row.replace("leetcode.com/", "leetcode.com.evil.test/"),
  ],
  ["URL with query", header + row.replace("/two-sum,", "/two-sum?token=x,")],
  ["duplicate row", header + row + "\n" + row],
  ["empty title", header + row.replace("Two Sum", "")],
  ["unclosed quote", header + '"1,unfinished'],
  ["characters after closing quote", header + '"1"x,unfinished'],
  ["quote within plain field", header + row.replace("Two Sum", 'Two"Sum')],
])
  test("rejects " + label, () =>
    assert.throws(() => parseCompanyCsv(input, "all.csv")),
  );
test("unsupported filename does not silently become all-time", () =>
  assert.throws(() => parseCompanyCsv(csv, "latest.csv"), /Unsupported/));
test("tampered fixture bytes fail checksum verification", async (t) => {
  const file = await changedFixture(t, async (dir) =>
    writeFile(path.join(dir, "all.csv"), csv + "\n"),
  );
  await assert.rejects(loadCompanySnapshot(file), /Checksum/);
});
for (const [label, change, pattern] of [
  [
    "moving branch",
    (_d, m) => {
      m.revision = "master";
    },
    /commit SHA/,
  ],
  [
    "row-count drift",
    (_d, m) => {
      m.files[0].rows = 2;
    },
    /Row count/,
  ],
  [
    "missing window",
    (_d, m) => {
      m.files.pop();
    },
    /two-file/,
  ],
  [
    "wrong window mapping",
    (_d, m) => {
      m.files[0].window = "30d";
    },
    /window mismatch/,
  ],
  [
    "path traversal",
    (_d, m) => {
      m.files[0].path = "../all.csv";
    },
    /unexpected source files/,
  ],
])
  test("rejects " + label, async (t) => {
    const file = await changedFixture(t, change);
    await assert.rejects(loadCompanySnapshot(file), pattern);
  });
test("metadata disagreement across windows fails the entire import", async (t) => {
  const file = await changedFixture(t, async (dir, m) => {
    const changed = csv.replace(
      "Separate Black and White Balls",
      "A conflicting title",
    );
    await writeFile(path.join(dir, "more-than-six-months.csv"), changed);
    m.files[1].sha256 = createHash("sha256").update(changed).digest("hex");
  });
  await assert.rejects(
    loadCompanySnapshot(file),
    /Conflicting question metadata/,
  );
});
test("SQL quoting handles apostrophes and dollar-quote delimiters", async () => {
  const data = await loadCompanySnapshot(manifestPath);
  data.questions[0].title = "Alice's $prepyard$ puzzle";
  const sql = toStagingSql(data);
  assert.ok(sql.includes("Alice''s $prepyard$ puzzle"));
  assert.ok(sql.includes("do $prepyard_$"));
});
