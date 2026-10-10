import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { applyHistory } from "../../src/features/leetcode/history-queries.mjs";
import {
  connectProfile,
  disconnectProfile,
  setSyncEnabled,
} from "../../src/features/leetcode/queries.mjs";

if (process.env.PREPYARD_DATABASE_TESTS !== "1")
  throw new Error(
    "Use the disposable database runner; explicit test opt-in is required.",
  );
const connectionString = process.env.TEST_DATABASE_URL;
const url = connectionString ? new URL(connectionString) : null;
const host = url?.hostname || process.env.PGHOST;
const database = url
  ? decodeURIComponent(url.pathname.slice(1))
  : process.env.PGDATABASE;
if (
  !["localhost", "127.0.0.1", "[::1]", "::1"].includes(host) ||
  !database?.endsWith("_test")
)
  throw new Error(
    "History tests only run on a local disposable database ending in _test.",
  );
const client = new pg.Client(
  connectionString ? { connectionString } : undefined,
);
await client.connect();
try {
  await client.query("begin");
  const user = randomUUID(),
    other = randomUUID(),
    platform = randomUUID(),
    q = randomUUID(),
    later = randomUUID(),
    prefix = "history-" + randomUUID();
  const slugs = Array.from({ length: 24 }, (_, i) => prefix + "-" + i);
  await client.query(
    "insert into private.students(id,name) values($1,'History Test'),($2,'Other History Test')",
    [user, other],
  );
  await client.query(
    "insert into public.platforms(id,slug,name,base_url) values($1,'leetcode','LeetCode','https://leetcode.com') on conflict(slug) do nothing",
    [platform],
  );
  const platformId = (
    await client.query("select id from public.platforms where slug='leetcode'")
  ).rows[0].id;
  await client.query(
    "insert into public.questions(id,platform_id,canonical_url,title,is_listed) values($1,$2,$3,'History fixture',true)",
    [q, platformId, "https://leetcode.com/problems/" + slugs[0] + "/"],
  );
  await client.query(
    "insert into public.user_question_state(user_id,question_id,status,confidence,bookmarked) values($1,$2,'attempted',2,true)",
    [user, q],
  );
  await client.query(
    "insert into public.notes(user_id,question_id,content) values($1,$2,'Keep this note')",
    [user, q],
  );
  async function owner(id) {
    await client.query("set local role authenticated");
    await client.query("select set_config('prepyard.student_id',$1,true)", [
      id,
    ]);
  }
  await owner(user);
  const connection = await connectProfile(client, "history_student");
  const history = {
    schema: 1,
    username: "history_student",
    bindingVersion: connection.binding_version,
    total: 24,
    slugs,
  };
  const first = await applyHistory(client, history);
  assert.deepEqual([first.total, first.matched, first.changed], [24, 1, 1]);
  assert.equal((await applyHistory(client, history)).skipped, true);
  const saved = (
    await client.query(
      "select status,confidence,bookmarked from public.user_question_state where question_id=$1",
      [q],
    )
  ).rows[0];
  assert.deepEqual(saved, {
    status: "solved",
    confidence: 2,
    bookmarked: true,
  });
  assert.equal(
    (
      await client.query(
        "select content from public.notes where question_id=$1",
        [q],
      )
    ).rows[0].content,
    "Keep this note",
  );
  assert.equal(
    (
      await client.query(
        "select count(*)::integer n from public.leetcode_history_questions",
      )
    ).rows[0].n,
    24,
  );
  async function due() {
    await client.query(
      "update public.leetcode_sync_settings set last_history_at=now()-interval '3 minutes'",
    );
  }
  await client.query(
    "update public.user_question_state set status='not_started' where question_id=$1",
    [q],
  );
  await due();
  assert.equal((await applyHistory(client, history)).changed, 0);
  await client.query("reset role");
  await client.query(
    "insert into public.questions(id,platform_id,canonical_url,title,is_listed) values($1,$2,$3,'Added later',true)",
    [later, platformId, "https://leetcode.com/problems/" + slugs[23] + "/"],
  );
  await owner(user);
  await due();
  assert.equal((await applyHistory(client, history)).changed, 1);
  assert.equal(
    (
      await client.query(
        "select status from public.user_question_state where question_id=$1",
        [later],
      )
    ).rows[0].status,
    "solved",
  );
  await setSyncEnabled(client, false);
  await due();
  assert.equal((await applyHistory(client, history)).skipped, true);
  await setSyncEnabled(client, true);
  await owner(other);
  assert.equal(
    (await client.query("select * from public.leetcode_history_questions"))
      .rowCount,
    0,
  );
  await assert.rejects(
    applyHistory(client, history),
    (error) => error.status === 409,
  );
  await owner(user);
  await connectProfile(client, "changed_student");
  await assert.rejects(
    applyHistory(client, history),
    (error) => error.status === 409,
  );
  assert.equal(
    (await client.query("select * from public.leetcode_history_questions"))
      .rowCount,
    0,
  );
  await disconnectProfile(client);
  assert.equal(
    (
      await client.query(
        "select content from public.notes where question_id=$1",
        [q],
      )
    ).rows[0].content,
    "Keep this note",
  );
  console.log(
    "Full-history database import checks passed; fixtures rolled back.",
  );
} finally {
  await client.query("rollback");
  await client.end();
}
