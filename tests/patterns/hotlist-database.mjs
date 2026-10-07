import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import {
  patternFilters,
  patternOverview,
  patternQuestions,
} from "../../src/features/patterns/queries.mjs";
const target = new URL(
  process.env.PREPYARD_AUTH_TEST_DATABASE_URL || "https://invalid",
);
if (
  !["localhost", "127.0.0.1"].includes(target.hostname) ||
  !target.pathname.endsWith("_test")
)
  throw Error("Use a migrated isolated loopback _test database.");
const c = new pg.Client({ connectionString: target.href });
try {
  await c.connect();
  await c.query("begin");
  const student = randomUUID(),
    other = randomUUID();
  await c.query("insert into private.students(id) values($1),($2)", [
    student,
    other,
  ]);
  const platform = (
    await c.query("select id from public.platforms where slug='leetcode'")
  ).rows[0].id;
  const topic = (
    await c.query("select id from public.dsa_topics where slug='arrays'")
  ).rows[0].id;
  const linked = (
    await c.query("select id from public.dsa_topics where slug='linked-lists'")
  ).rows[0].id;
  const companies = [];
  for (let i = 0; i < 2; i++)
    companies.push(
      (
        await c.query(
          "insert into public.companies(slug,name) values($1,$2) returning id",
          ["hotlist-" + randomUUID(), "Hotlist test " + i],
        )
      ).rows[0].id,
    );
  const snapshots = [];
  for (const [reuse, visibility, status] of [
    ["approved", true, "published"],
    ["approved", true, "published"],
    ["approved", true, "archived"],
    ["pending", true, "published"],
    ["approved", false, "published"],
  ]) {
    const source = (
      await c.query(
        "insert into public.sources(slug,name,url,adapter,attribution,reuse_status,is_public) values($1,'Test','https://example.com','test','Test',$2,$3) returning id",
        ["hotlist-" + randomUUID(), reuse, visibility],
      )
    ).rows[0].id;
    snapshots.push(
      (
        await c.query(
          "insert into public.source_snapshots(source_id,revision,status,published_at) values($1,'test',$2,now()) returning id",
          [source, status],
        )
      ).rows[0].id,
    );
  }
  const questions = [];
  for (let i = 0; i < 29; i++) {
    const key = "hotlist-" + randomUUID();
    const q = (
      await c.query(
        "insert into public.questions(platform_id,external_id,canonical_url,title,difficulty,is_listed) values($1,$2,$3,$4,'easy',$5) returning id",
        [
          platform,
          key,
          "https://leetcode.com/problems/" + key,
          "Hotlist " + String(i).padStart(2, "0"),
          i !== 28,
        ],
      )
    ).rows[0].id;
    questions.push(q);
    await c.query("insert into public.question_dsa_topics values($1,$2)", [
      q,
      i === 25 ? linked : topic,
    ]);
  }
  const observe = (snapshot, company, q, window, frequency, kind = "percent") =>
    c.query(
      "insert into public.company_question_observations(snapshot_id,company_id,question_id,time_window,frequency,frequency_kind) values($1,$2,$3,$4,$5,$6)",
      [
        snapshots[snapshot],
        companies[company],
        questions[q],
        window,
        frequency,
        kind,
      ],
    );
  for (let i = 0; i < 25; i++)
    await observe(0, 0, i, "all", i < 2 ? 90 : i === 2 ? 80 : 80 - i);
  await observe(0, 1, 0, "all", 90);
  await observe(0, 1, 2, "all", 40);
  await observe(1, 0, 0, "all", 89); // Same company through a second source must not inflate coverage.
  await observe(0, 0, 25, "all", 75); // Another data structure is independently shortlisted.
  await observe(0, 0, 26, "all", null, "unknown");
  await observe(0, 0, 27, "all", 100, "count");
  await observe(0, 0, 28, "all", 100); // Unlisted question.
  await observe(0, 0, 24, "30d", 100); // Overlapping shorter window.
  for (let s = 2; s < 5; s++) await observe(s, 0, 24, "all", 100); // Archived/unapproved/private sources.
  await c.query(
    "insert into public.user_question_state(user_id,question_id,status) values($1,$2,'solved')",
    [student, questions[0]],
  );
  await c.query("set local role authenticated");
  await c.query("select set_config('prepyard.student_id',$1,true)", [student]);
  const f = patternFilters({
    collection: "interview-hotlist",
    topic: "arrays",
  });
  let rows = await patternQuestions(c, f);
  assert.equal(rows.total, 20);
  assert.equal(rows.solved, 1);
  assert.deepEqual(
    rows.rows.map((q) => q.id),
    questions.slice(0, 20),
  );
  assert.equal(Number(rows.rows[0].reported_frequency), 90);
  assert.equal(rows.rows[0].company_count, 2);
  assert.equal(rows.rows[1].company_count, 1);
  assert.equal(
    (await patternQuestions(c, patternFilters({ ...f, q: "Hotlist 24" })))
      .total,
    0,
    "Search narrows the top 20; it does not rerank the full catalogue",
  );
  assert.equal(
    (
      await patternOverview(
        c,
        patternFilters({
          collection: "interview-hotlist",
          topic: "linked-lists",
        }),
      )
    ).total,
    1,
  );
  assert.equal(
    (await patternQuestions(c, patternFilters({ ...f, sort: "random" }))).total,
    20,
  );
  await c.query("select set_config('prepyard.student_id',$1,true)", [other]);
  assert.equal(
    (await patternQuestions(c, f)).solved,
    0,
    "Progress belongs to the current student",
  );
  await c.query("reset role");
  await c.query(
    "update public.company_question_observations set frequency=99 where snapshot_id=$1 and question_id=$2 and time_window='all'",
    [snapshots[0], questions[24]],
  );
  await c.query("set local role authenticated");
  rows = await patternQuestions(c, f);
  assert.equal(
    rows.rows[0].id,
    questions[24],
    "Published data changes appear immediately without re-publication of collections",
  );
  await c.query("select set_config('prepyard.student_id','',true)");
  assert.equal(
    (await c.query("select * from public.topic_frequency_questions")).rows
      .length,
    0,
  );
  await c.query("savepoint anonymous_check");
  await c.query("set local role anon");
  await assert.rejects(
    c.query("select * from public.topic_frequency_questions"),
    /permission denied/,
  );
  await c.query("rollback to savepoint anonymous_check");
  await c.query("rollback");
  console.log(
    "PASS: top 20 per topic, frequency/coverage ordering, company deduplication, source/window eligibility, live refresh, filtering, progress privacy and anonymous denial.",
  );
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}
