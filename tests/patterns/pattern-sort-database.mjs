import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import {
  patternQuestions,
  patternFilters,
} from "../../src/features/patterns/queries.mjs";
import {
  companySheet,
  filtersFrom,
} from "../../src/features/catalogue/queries.mjs";
const target = new URL(
  process.env.PREPYARD_AUTH_TEST_DATABASE_URL || "https://invalid",
);
if (
  !["localhost", "127.0.0.1"].includes(target.hostname) ||
  !target.pathname.endsWith("_test")
)
  throw Error("Use an isolated migrated loopback _test database.");
const c = new pg.Client({ connectionString: target.href });
try {
  await c.connect();
  await c.query("begin");
  const student = randomUUID(),
    other = randomUUID(),
    slug = "sort-" + randomUUID();
  await c.query("insert into private.students(id) values($1),($2)", [
    student,
    other,
  ]);
  const p = (
    await c.query(
      "insert into public.patterns(slug,name) values($1,'Sort test') returning id",
      [slug],
    )
  ).rows[0].id;
  const platform = (
    await c.query("select id from public.platforms where slug='leetcode'")
  ).rows[0].id;
  const topic = (
    await c.query("select id from public.dsa_topics where slug='arrays'")
  ).rows[0].id;
  const ids = [];
  for (const [i, difficulty] of [
    "easy",
    "hard",
    "medium",
    "easy",
    "hard",
  ].entries()) {
    const key = "sort-" + randomUUID();
    const q = (
      await c.query(
        "insert into public.questions(platform_id,external_id,canonical_url,title,difficulty,is_listed) values($1,$2,$3,$4,$5,true) returning id",
        [
          platform,
          key,
          "https://leetcode.com/problems/" + key,
          "Sort " + i,
          difficulty,
        ],
      )
    ).rows[0].id;
    ids.push(q);
    await c.query("insert into public.question_dsa_topics values($1,$2)", [
      q,
      topic,
    ]);
    await c.query(
      "insert into public.question_patterns values($1,$2,'test',true)",
      [q, p],
    );
  }
  await c.query(
    "insert into public.user_question_state(user_id,question_id,confidence,next_revision_at) values($1,$2,4,now()-interval '1 day'),($1,$3,1,now()+interval '1 day'),($1,$4,4,now()+interval '2 days')",
    [student, ids[1], ids[2], ids[3]],
  );
  await c.query(
    "insert into public.user_question_state(user_id,question_id,confidence,next_revision_at) values($1,$2,2,now()-interval '2 days')",
    [other, ids[0]],
  );
  await c.query(
    "insert into public.notes(user_id,question_id,content) values($1,$2,'Saved approach')",
    [student, ids[0]],
  );
  const company = (
    await c.query(
      "insert into public.companies(slug,name) values($1,'Column sort test') returning id",
      [slug],
    )
  ).rows[0].id;
  const source = (
    await c.query(
      "insert into public.sources(slug,name,url,adapter,attribution,reuse_status,is_public,enabled) values($1,'Column sort test','https://example.com','test','Test','approved',true,true) returning id",
      [slug],
    )
  ).rows[0].id;
  const snapshot = (
    await c.query(
      "insert into public.source_snapshots(source_id,revision,status,published_at) values($1,'current','published',now()) returning id",
      [source],
    )
  ).rows[0].id;
  for (const [i, frequency] of [80, 60, 60, 90, 90].entries())
    await c.query(
      "insert into public.company_question_observations(snapshot_id,company_id,question_id,time_window,frequency,frequency_kind) values($1,$2,$3,'all',$4,'percent')",
      [snapshot, company, ids[i], frequency],
    );
  await c.query("set local role authenticated");
  await c.query("select set_config('prepyard.student_id',$1,true)", [student]);
  for (const [sort, order] of [
    ["difficulty-asc", [0, 3, 2, 1, 4]],
    ["difficulty-desc", [1, 4, 2, 0, 3]],
    ["revision", [1, 2, 3, 0, 4]],
  ]) {
    const result = await patternQuestions(
      c,
      patternFilters({ pattern: slug, sort }),
    );
    assert.deepEqual(
      result.rows.map((q) => q.id),
      order.map((i) => ids[i]),
    );
    assert.equal(result.total, 5);
  }
  for (const [order, expected] of [
    ["difficulty-asc,revision-asc", [3, 0, 2, 1, 4]],
    ["difficulty-asc,title-desc", [3, 0, 2, 4, 1]],
  ]) {
    const rows = await patternQuestions(
      c,
      patternFilters({ pattern: slug, order }),
    );
    assert.deepEqual(
      rows.rows.map((q) => q.id),
      expected.map((i) => ids[i]),
    );
  }
  for (const [order, expected] of [
    ["frequency-desc,difficulty-asc", [3, 4, 0, 2, 1]],
    ["revision-asc,difficulty-desc", [1, 2, 3, 4, 0]],
  ]) {
    const sheet = await companySheet(c, slug, filtersFrom({ order }));
    assert.deepEqual(
      sheet.rows.map((q) => q.id),
      expected.map((i) => ids[i]),
    );
  }
  let result = await patternQuestions(
    c,
    patternFilters({ pattern: slug, sort: "revision" }),
  );
  assert.equal(result.rows[0].revision_confidence, 4);
  assert.equal(result.rows[1].revision_confidence, 1);
  assert.equal(
    result.rows.find((q) => q.id === ids[0]).revision_confidence,
    null,
  );
  assert.ok(result.rows.find((q) => q.id === ids[0]).has_note);
  await c.query("select set_config('prepyard.student_id',$1,true)", [other]);
  result = await patternQuestions(
    c,
    patternFilters({ pattern: slug, sort: "revision" }),
  );
  assert.equal(result.rows[0].id, ids[0]);
  assert.equal(result.rows[0].revision_confidence, 2);
  assert.equal(result.rows[0].has_note, false);
  await c.query("rollback");
  console.log(
    "PASS: both difficulty orders, revision priority, saved confidence/note projection and user privacy.",
  );
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}
