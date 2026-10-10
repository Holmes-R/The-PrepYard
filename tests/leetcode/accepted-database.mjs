import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import {
  connectProfile,
  claimSync,
  applyAccepted,
  setSyncEnabled,
  disconnectProfile,
} from "../../src/features/leetcode/queries.mjs";

if (process.env.PREPYARD_DATABASE_TESTS !== "1")
  throw new Error("Explicit disposable database test opt-in required.");
const url = process.env.TEST_DATABASE_URL
  ? new URL(process.env.TEST_DATABASE_URL)
  : null;
const host = url?.hostname || process.env.PGHOST;
const database = url
  ? decodeURIComponent(url.pathname.slice(1))
  : process.env.PGDATABASE;
if (
  !["localhost", "127.0.0.1", "[::1]", "::1"].includes(host) ||
  !database?.endsWith("_test")
)
  throw new Error("Tests require a local disposable database ending in _test.");
const client = new pg.Client(url ? { connectionString: url.href } : undefined);
await client.connect();
try {
  await client.query("begin");
  const user = randomUUID(),
    question = randomUUID(),
    oldQuestion = randomUUID();
  const slug = "accepted-" + randomUUID();
  const cutoff = "2026-10-01T12:00:00.000Z";
  await client.query(
    "insert into private.students(id,name) values($1,'New Accepted Test')",
    [user],
  );
  const platform = (
    await client.query("select id from public.platforms where slug='leetcode'")
  ).rows[0]?.id;
  assert.ok(platform, "LeetCode platform fixture exists");
  await client.query(
    "insert into public.questions(id,platform_id,canonical_url,title,is_listed) values($1,$3,$4,'New accepted fixture',true),($2,$3,$5,'Old accepted fixture',true)",
    [
      question,
      oldQuestion,
      platform,
      "https://leetcode.com/problems/" + slug + "/",
      "https://leetcode.com/problems/" + slug + "-old/",
    ],
  );
  await client.query(
    "insert into public.user_question_state(user_id,question_id,status,confidence,bookmarked) values($1,$2,'attempted',2,true)",
    [user, question],
  );
  await client.query(
    "insert into public.notes(user_id,question_id,content) values($1,$2,'Preserve my approach')",
    [user, question],
  );
  await client.query("set local role authenticated");
  await client.query("select set_config('prepyard.student_id',$1,true)", [
    user,
  ]);
  const linked = await connectProfile(client, "new_solves_student");
  assert.equal(linked.enabled, true, "automatic sync is on by default");
  await client.query("update public.leetcode_sync_settings set created_at=$1", [
    cutoff,
  ]);
  const claim = await claimSync(client);
  assert.ok(claim);
  assert.equal(await claimSync(client), null, "database cooldown enforced");
  const submission = (id, submittedAt, suffix = "") => ({
    id,
    slug: slug + suffix,
    submittedAt,
  });
  const old = submission("10001", "2026-10-01T11:59:59.000Z", "-old");
  const boundary = submission("10002", cutoff);
  assert.deepEqual(await applyAccepted(client, claim, [old, boundary]), {
    cancelled: false,
    matched: 0,
    changed: 0,
  });
  assert.equal(
    (await client.query("select * from public.leetcode_sync_receipts"))
      .rowCount,
    0,
    "older and boundary submissions never create receipts",
  );
  const fresh = submission("10003", "2026-10-01T12:00:01.000Z");
  assert.deepEqual(await applyAccepted(client, claim, [old, boundary, fresh]), {
    cancelled: false,
    matched: 1,
    changed: 1,
  });
  assert.deepEqual(
    (
      await client.query(
        "select status,confidence,bookmarked from public.user_question_state where question_id=$1",
        [question],
      )
    ).rows[0],
    { status: "solved", confidence: 2, bookmarked: true },
  );
  assert.equal(
    (
      await client.query(
        "select content from public.notes where question_id=$1",
        [question],
      )
    ).rows[0].content,
    "Preserve my approach",
  );
  assert.equal(
    (
      await client.query(
        "select * from public.user_question_state where question_id=$1",
        [oldQuestion],
      )
    ).rowCount,
    0,
    "old solves left untouched",
  );
  await client.query(
    "update public.user_question_state set status='not_started' where question_id=$1",
    [question],
  );
  assert.equal(
    (await applyAccepted(client, claim, [fresh])).changed,
    0,
    "duplicate sync preserves manual uncheck",
  );
  assert.equal(
    (
      await applyAccepted(client, claim, [
        submission("10004", "2026-10-01T12:00:02.000Z"),
      ])
    ).changed,
    1,
    "new accepted re-solve updates completion",
  );
  await setSyncEnabled(client, false);
  assert.equal(
    (
      await applyAccepted(client, claim, [
        submission("10005", "2026-10-01T12:00:03.000Z"),
      ])
    ).cancelled,
    true,
    "paused connections reject writes",
  );
  const resumed = await setSyncEnabled(client, true);
  assert.equal(
    resumed.sync_started_at.toISOString(),
    cutoff,
    "resume retains cutoff",
  );
  const same = await connectProfile(client, "NEW_SOLVES_STUDENT");
  assert.equal(
    same.sync_started_at.toISOString(),
    cutoff,
    "same profile reconnect retains cutoff",
  );
  assert.equal(same.binding_version, claim.binding_version);
  const changed = await connectProfile(client, "changed_solves_student");
  assert.notEqual(changed.binding_version, claim.binding_version);
  assert.ok(
    changed.sync_started_at > new Date(cutoff),
    "username change starts a new window",
  );
  assert.equal(
    (await applyAccepted(client, claim, [fresh])).cancelled,
    true,
    "stale request rejected",
  );
  assert.equal(
    (await applyAccepted(client, changed, [fresh])).changed,
    0,
    "previous profile solves cannot enter a new window",
  );
  await disconnectProfile(client);
  const reconnected = await connectProfile(client, "changed_solves_student");
  assert.notEqual(reconnected.binding_version, changed.binding_version);
  assert.equal(reconnected.enabled, true);
  console.log(
    "New Accepted-only database checks passed; fixtures rolled back.",
  );
} finally {
  await client.query("rollback");
  await client.end();
}
