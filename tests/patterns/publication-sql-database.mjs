import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { publishCollections } from "../../scripts/patterns/collections.mjs";
const target = new URL(
  process.env.PREPYARD_AUTH_TEST_DATABASE_URL || "https://invalid",
);
if (
  !["127.0.0.1", "localhost"].includes(target.hostname) ||
  !target.pathname.endsWith("_test")
)
  throw new Error("Use a migrated isolated loopback _test database.");
const c = new pg.Client({ connectionString: target.href });
const student = randomUUID();
try {
  await c.connect();
  await publishCollections(c);
  const q = (
    await c.query(
      "select q.id from public.questions q join public.platforms p on p.id=q.platform_id where p.slug='leetcode' and q.external_id='1'",
    )
  ).rows[0].id;
  await c.query("insert into private.students(id) values($1)", [student]);
  await c.query(
    "insert into public.user_question_state(user_id,question_id,status,bookmarked,confidence) values($1,$2,'solved',true,4)",
    [student, q],
  );
  await c.query(
    "insert into public.notes(user_id,question_id,content) values($1,$2,'Preserve my approach')",
    [student, q],
  );
  await c.query(
    "insert into public.practice_events(user_id,question_id,event_type,confidence) values($1,$2,'reviewed',4)",
    [student, q],
  );
  const legacy = (
    await c.query(
      "insert into public.pattern_collections(slug,name) values('neetcode-150','Retired test collection') returning id",
    )
  ).rows[0].id;
  await c.query(
    "insert into public.pattern_collection_questions values($1,$2,0)",
    [legacy, q],
  );
  async function snapshot() {
    const rows = [];
    for (const table of ["user_question_state", "notes", "practice_events"])
      rows.push(
        (
          await c.query(
            "select * from public." + table + " order by user_id,question_id",
          )
        ).rows,
      );
    return rows;
  }
  const before = await snapshot();
  const ids = (
    await c.query("select id,external_id from public.questions order by id")
  ).rows;
  const sql = await readFile(
    new URL("../../scripts/patterns/publish-prepyard.sql", import.meta.url),
    "utf8",
  );
  await c.query(sql);
  await c.query(sql);
  assert.deepEqual(await snapshot(), before);
  assert.deepEqual(
    (await c.query("select id,external_id from public.questions order by id"))
      .rows,
    ids,
  );
  assert.equal(
    (
      await c.query(
        "select count(*)::int n from public.pattern_collections where slug='neetcode-150'",
      )
    ).rows[0].n,
    0,
  );
  assert.deepEqual(
    (
      await c.query(
        "select count(*)::int n from public.pattern_collection_questions group by collection_id order by count(*)",
      )
    ).rows.map((r) => r.n),
    [66, 282],
  );
  console.log(
    "PASS: SQL publication replay preserves canonical IDs, saved progress, private notes and revision history while retiring old memberships.",
  );
} finally {
  await c.query("rollback").catch(() => {});
  await c
    .query("delete from private.students where id=$1", [student])
    .catch(() => {});
  await c.end();
}
