import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { publishCollections } from "../../scripts/patterns/collections.mjs";
import {
  patternOverview,
  patternQuestions,
  patternFilters,
} from "../../src/features/patterns/queries.mjs";
const target = new URL(
  process.env.PREPYARD_AUTH_TEST_DATABASE_URL || "https://invalid",
);
if (
  !["127.0.0.1", "localhost"].includes(target.hostname) ||
  !target.pathname.endsWith("_test")
)
  throw new Error("Use an isolated loopback _test database.");
const client = new pg.Client({ connectionString: target.href });
try {
  await client.connect();
  const fixture = JSON.parse(
    await readFile(
      new URL("../../scripts/patterns/collections.json", import.meta.url),
      "utf8",
    ),
  );
  const first = await publishCollections(client);
  const second = await publishCollections(client);
  assert.deepEqual(first, second);
  const before = (
    await client.query("select count(*)::int n from public.questions")
  ).rows[0].n;
  const invalid = structuredClone(fixture);
  invalid.collections[0].questions[0].externalId = "999999";
  await assert.rejects(
    publishCollections(client, invalid),
    /Conflicting question identity/,
  );
  assert.equal(
    (await client.query("select count(*)::int n from public.questions")).rows[0]
      .n,
    before,
  );
  await client.query("begin");
  const student = randomUUID();
  await client.query("insert into private.students(id) values($1)", [student]);
  const shared = (
    await client.query(
      "select q.id from public.questions q join public.platforms p on p.id=q.platform_id where p.slug='leetcode' and q.external_id='1'",
    )
  ).rows[0].id;
  await client.query(
    "insert into public.user_question_state(user_id,question_id,status) values($1,$2,'solved')",
    [student, shared],
  );
  await client.query("set local role authenticated");
  await client.query("select set_config('prepyard.student_id',$1,true)", [
    student,
  ]);
  for (const sheet of fixture.collections) {
    const overview = await patternOverview(
      client,
      patternFilters({ collection: sheet.slug }),
    );
    assert.equal(overview.total, sheet.expectedCount);
    assert.equal(
      overview.solved,
      sheet.questions.some(
        (q) => q.platform === "leetcode" && q.externalId === "1",
      )
        ? 1
        : 0,
    );
    const expected = sheet.questions
      .slice(0, 30)
      .map((q) => q.url.replace(/\/$/, ""));
    const actual = await patternQuestions(
      client,
      patternFilters({ collection: sheet.slug }),
    );
    assert.deepEqual(
      actual.rows.map((q) => q.canonical_url.replace(/\/$/, "")),
      expected,
    );
  }
  await client.query("rollback");
  console.log(
    "PASS: both referenced collection counts, idempotence, rollback on identity conflict, selected-sheet ordering and shared student progress.",
  );
  console.log(first);
} finally {
  await client.query("rollback").catch(() => {});
  await client.end();
}
