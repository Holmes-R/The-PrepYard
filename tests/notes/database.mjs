import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { studentNotes } from "../../src/features/notes/queries.mjs";
if (process.env.PREPYARD_DATABASE_TESTS !== "1")
  throw Error("Explicit disposable database opt-in required.");
const url = process.env.TEST_DATABASE_URL
  ? new URL(process.env.TEST_DATABASE_URL)
  : null;
const host = url?.hostname || process.env.PGHOST,
  database = url
    ? decodeURIComponent(url.pathname.slice(1))
    : process.env.PGDATABASE;
if (
  !["localhost", "127.0.0.1", "[::1]", "::1"].includes(host) ||
  !database?.endsWith("_test")
)
  throw Error("Only a disposable local _test database is allowed.");
const client = new pg.Client(url ? { connectionString: url.href } : undefined);
await client.connect();
try {
  await client.query("begin");
  const user = randomUUID(),
    other = randomUUID(),
    platform = randomUUID(),
    prefix = "NotesFixture-" + randomUUID();
  await client.query(
    "insert into private.students(id,name) values($1,'Note Search Test'),($2,'Other Note Search Test')",
    [user, other],
  );
  await client.query(
    "insert into public.platforms(id,slug,name,base_url) values($1,$2,'Notes fixture','https://example.test')",
    [platform, prefix.toLowerCase()],
  );
  for (let i = 0; i < 26; i++) {
    const q = randomUUID();
    await client.query(
      "insert into public.questions(id,platform_id,canonical_url,title,is_listed) values($1,$2,$3,$4,true)",
      [q, platform, "https://example.test/" + q, prefix + " " + i],
    );
    await client.query(
      "insert into public.notes(user_id,question_id,content,updated_at) values($1,$2,$3,$4)",
      [
        user,
        q,
        i === 25 ? "Unique OLD needle %_'" : "Generic private note",
        new Date(Date.UTC(2020, 0, 26 - i)).toISOString(),
      ],
    );
  }
  await client.query("set local role authenticated");
  await client.query("select set_config('prepyard.student_id',$1,true)", [
    user,
  ]);
  const first = await studentNotes(client);
  assert.equal(first.total, 26);
  assert.equal(first.rows.length, 24);
  assert.ok(!first.rows.some((n) => n.content.includes("needle")));
  const found = await studentNotes(client, 1, "needle");
  assert.equal(found.total, 1);
  assert.equal(found.rows[0].content, "Unique OLD needle %_'");
  assert.equal(
    (await studentNotes(client, 1, "%_'")).total,
    1,
    "wildcards are literal",
  );
  assert.equal(
    (await studentNotes(client, 1, "' OR 1=1 --")).total,
    0,
    "query is not SQL",
  );
  assert.equal(
    (await studentNotes(client, 1, prefix.toUpperCase())).total,
    26,
    "case-insensitive title search",
  );
  assert.equal(
    (await studentNotes(client, 99, "needle")).page,
    1,
    "filtered pagination clamps safely",
  );
  assert.deepEqual(found.rows[0].tags, [], "untagged notes have an empty list");
  const taggedId = found.rows[0].id;
  await client.query(
    "update public.notes set tags=$1::text[] where question_id=$2",
    [["Review", "Edge cases"], taggedId],
  );
  const tagged = await studentNotes(client, 1, "review");
  assert.equal(tagged.total, 1);
  assert.deepEqual(tagged.rows[0].tags, ["Review", "Edge cases"]);
  assert.equal(
    tagged.rows[0].content,
    "Unique OLD needle %_'",
    "tag updates preserve writing",
  );
  for (const invalid of [
    [""],
    [" padded"],
    ["x".repeat(33)],
    ["Same", "same"],
    [null],
    Array.from({ length: 9 }, (_, i) => "Tag" + i),
    [["a"], ["b"]],
  ]) {
    await client.query("savepoint invalid_note_tags");
    await assert.rejects(
      client.query(
        "update public.notes set tags=$1::text[] where question_id=$2",
        [invalid, taggedId],
      ),
      (error) => error.code === "23514",
    );
    await client.query("rollback to savepoint invalid_note_tags");
    await client.query("release savepoint invalid_note_tags");
  }
  await client.query("select set_config('prepyard.student_id',$1,true)", [
    other,
  ]);
  assert.equal(
    (await studentNotes(client, 1, "needle")).total,
    0,
    "no other student content",
  );
  assert.equal(
    (await studentNotes(client, 1, "review")).total,
    0,
    "another student's tags stay private",
  );
  assert.equal(
    (
      await client.query(
        "update public.notes set tags='{}' where question_id=$1",
        [taggedId],
      )
    ).rowCount,
    0,
    "another student cannot change tags",
  );
  console.log(
    "Private note search and tag constraint checks passed; fixtures rolled back.",
  );
} finally {
  await client.query("rollback");
  await client.end();
}
