import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import {
  roadmapPatterns,
  roadmapChoices,
} from "../../src/features/patterns/roadmap.mjs";
import {
  patternOverview,
  patternQuestions,
  patternFilters,
} from "../../src/features/patterns/queries.mjs";
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
  const selected = roadmapPatterns.filter((p) =>
    [1, 6, 13, 15, 16].includes(p.position),
  );
  const ids = new Map();
  for (const p of selected)
    for (const q of p.questions) {
      if (ids.has(q.url)) continue;
      let found = (
        await c.query(
          "select id from public.questions where rtrim(canonical_url,'/')=rtrim($1,'/')",
          [q.url],
        )
      ).rows[0];
      if (!found)
        found = (
          await c.query(
            "insert into public.questions(platform_id,external_id,canonical_url,title,difficulty,is_listed) values($1,$2,$3,$4,'medium',true) returning id",
            [platform, q.externalId, q.url, q.title],
          )
        ).rows[0];
      await c.query("update public.questions set is_listed=true where id=$1", [
        found.id,
      ]);
      await c.query(
        "insert into public.question_dsa_topics(question_id,topic_id) values($1,$2) on conflict(question_id) do nothing",
        [found.id, topic],
      );
      ids.set(q.url, found.id);
    }
  const first = ids.get(selected[0].questions[0].url),
    second = ids.get(selected[0].questions[1].url);
  await c.query(
    "insert into public.notes(user_id,question_id,content) values($1,$2,'My approach')",
    [student, first],
  );
  await c.query(
    "insert into public.user_question_state(user_id,question_id,status,confidence,next_revision_at) values($1,$2,'solved',4,now()+interval '3 days'),($1,$3,'not_started',1,now()-interval '1 day'),($4,$2,'not_started',2,now()-interval '2 days')",
    [student, first, second, other],
  );
  await c.query("set local role authenticated");
  await c.query("select set_config('prepyard.student_id',$1,true)", [student]);
  assert.deepEqual(
    (await patternOverview(c, patternFilters())).patterns,
    roadmapChoices,
  );
  for (const p of selected) {
    const result = await patternQuestions(
      c,
      patternFilters({ pattern: p.slug }),
    );
    assert.deepEqual(
      result.rows.slice(0, p.questions.length).map((q) => q.id),
      p.questions.map((q) => ids.get(q.url)),
      p.name + " reference order",
    );
    assert.equal(
      new Set(result.rows.map((q) => q.id)).size,
      result.rows.length,
    );
    assert.ok(
      result.rows.every((q) => q.patterns.some((tag) => tag.slug === p.slug)),
    );
  }
  let result = await patternQuestions(
    c,
    patternFilters({ pattern: selected[0].slug }),
  );
  assert.equal(result.rows[0].has_note, true);
  assert.equal(result.rows[0].status, "solved");
  assert.equal(result.rows[0].revision_confidence, 4);
  result = await patternQuestions(
    c,
    patternFilters({ pattern: selected[0].slug, sort: "revision" }),
  );
  assert.equal(result.rows[0].id, second);
  for (const sort of ["difficulty-asc", "difficulty-desc"]) {
    const rows = (
      await patternQuestions(
        c,
        patternFilters({ pattern: selected[0].slug, sort }),
      )
    ).rows;
    const rank =
      sort === "difficulty-asc"
        ? { easy: 1, medium: 2, hard: 3 }
        : { hard: 1, medium: 2, easy: 3 };
    assert.ok(
      rows.every(
        (q, i) => !i || rank[q.difficulty] >= rank[rows[i - 1].difficulty],
      ),
    );
  }
  const a = await patternQuestions(
    c,
    patternFilters({ pattern: "binary-search" }),
  );
  const b = await patternQuestions(
    c,
    patternFilters({ pattern: "modified-binary-search" }),
  );
  assert.deepEqual(a, b);
  await c.query("select set_config('prepyard.student_id',$1,true)", [other]);
  result = await patternQuestions(
    c,
    patternFilters({ pattern: selected[0].slug }),
  );
  assert.equal(result.rows[0].has_note, false);
  assert.equal(result.rows[0].revision_confidence, 2);
  assert.equal(result.rows[0].status, "not_started");
  console.log(
    "PASS: roadmap groups without database pattern rows, exact reference order, overlapping membership without duplicates, alias equivalence, explicit sorting and private tracking.",
  );
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}
