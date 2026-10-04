import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pathToFileURL, fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const { Client } = createRequire(root + "package.json")("pg");
const { publishPatterns } = await import(
  pathToFileURL(root + "scripts/patterns/publish.mjs")
);
const { patternFilters, patternOverview, patternQuestions } = await import(
  pathToFileURL(root + "src/features/patterns/queries.mjs")
);
const target = new URL(
  process.env.PREPYARD_AUTH_TEST_DATABASE_URL || "https://invalid",
);
if (
  !["127.0.0.1", "localhost"].includes(target.hostname) ||
  !target.pathname.endsWith("_test")
)
  throw new Error("Use a populated isolated loopback _test database.");
const client = new Client({ connectionString: target.href });
try {
  await client.connect();
  if (
    !(await client.query("select to_regclass('public.dsa_topics') t")).rows[0].t
  )
    await client.query(
      readFileSync(
        root + "supabase/migrations/20261004000900_dsa_sheet.sql",
        "utf8",
      ),
    );
  const first = await publishPatterns(client);
  const second = await publishPatterns(client);
  assert.deepEqual(first, second);
  console.log(first);
  await client.query("begin");
  const a = randomUUID(),
    b = randomUUID();
  await client.query("insert into private.students(id) values($1),($2)", [
    a,
    b,
  ]);
  const q = (
    await client.query(
      "select q.id from public.questions q join public.pattern_collection_questions c on c.question_id=q.id limit 1",
    )
  ).rows[0].id;
  await client.query(
    "insert into public.user_question_state(user_id,question_id,status,bookmarked) values($1,$2,'solved',true)",
    [a, q],
  );
  await client.query(
    "insert into public.notes(user_id,question_id,content) values($1,$2,'private-a')",
    [a, q],
  );
  await client.query("set local role authenticated");
  await client.query("select set_config('prepyard.student_id',$1,true)", [a]);
  const all = await patternOverview(
    client,
    patternFilters({ collection: "kushal-essential-patterns" }),
  );
  assert.equal(all.total, 178);
  assert.equal(all.solved, 1);
  const prefix = await patternOverview(
    client,
    patternFilters({
      collection: "kushal-essential-patterns",
      pattern: "prefix-sum",
    }),
  );
  assert.equal(prefix.total, 5);
  const rows = await patternQuestions(
    client,
    patternFilters({
      collection: "kushal-essential-patterns",
      progress: "bookmarked",
    }),
  );
  assert.equal(rows.total, 1);
  assert.equal(rows.rows[0].note, "private-a");
  await client.query("select set_config('prepyard.student_id',$1,true)", [b]);
  const other = await patternQuestions(
    client,
    patternFilters({ progress: "bookmarked" }),
  );
  assert.equal(other.total, 0);
  const stranger = await patternOverview(
    client,
    patternFilters({ collection: "kushal-essential-patterns" }),
  );
  assert.equal(stranger.solved, 0);
  await assert.rejects(
    client.query(
      "insert into public.dsa_topics(slug,name,position) values('evil','Evil',1)",
    ),
    /permission denied/,
  );
  await client.query("rollback");
  await client.query("begin");
  await client.query("set local role anon");
  await assert.rejects(
    client.query("select * from public.dsa_topics"),
    /permission denied/,
  );
  await client.query("rollback");
  console.log(
    "PASS: repeat publication, 178 unique collection questions, pattern filters, private notes/progress, no student catalogue writes, anonymous access denied.",
  );
} finally {
  await client.query("rollback").catch(() => {});
  await client.end();
}
