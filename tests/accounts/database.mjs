import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import {
  connectAccount,
  claimAccountSync,
  applySolvedSnapshot,
  setAccountEnabled,
  disconnectAccount,
  accountSettings,
} from "../../src/features/accounts/queries.mjs";
import {
  companySheet,
  filtersFrom,
} from "../../src/features/catalogue/queries.mjs";
import {
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
  throw Error("Use an isolated migrated loopback _test database");
const c = new pg.Client({ connectionString: target.href });
try {
  await c.connect();
  await c.query("begin");
  const owner = randomUUID(),
    other = randomUUID(),
    fixture = "account-" + randomUUID();
  await c.query("insert into private.students(id) values($1),($2)", [
    owner,
    other,
  ]);
  const platform = (
    await c.query(
      "insert into public.platforms(slug,name,base_url) values('leetcode','LeetCode','https://leetcode.com') on conflict(slug) do update set name=excluded.name returning id",
    )
  ).rows[0].id;
  const source = (
    await c.query(
      "insert into public.sources(slug,name,url,adapter,attribution,reuse_status,is_public,enabled) values($1,'Account sync test','https://example.com','test','Test','approved',true,true) returning id",
      [fixture],
    )
  ).rows[0].id;
  const snapshot = (
    await c.query(
      "insert into public.source_snapshots(source_id,revision,status,published_at) values($1,'sync','published',now()) returning id",
      [source],
    )
  ).rows[0].id;
  const company = (
    await c.query(
      "insert into public.companies(slug,name) values($1,'Sync test') returning id",
      [fixture],
    )
  ).rows[0].id;
  const topic = (
    await c.query(
      "insert into public.dsa_topics(slug,name,position) values('arrays','Arrays',1) on conflict(slug) do update set name=excluded.name returning id",
    )
  ).rows[0].id;
  const ids = [];
  for (const [external, title, slug] of [
    ["252", "Meeting Rooms", "meeting-rooms"],
    ["253", "Meeting Rooms II", "meeting-rooms-ii"],
  ]) {
    const id = (
      await c.query(
        "insert into public.questions(platform_id,external_id,canonical_url,title,difficulty,is_listed) values($1,$2,$3,$4,'medium',true) on conflict(platform_id,external_id) do update set canonical_url=excluded.canonical_url,title=excluded.title,is_listed=true returning id",
        [
          platform,
          external,
          "https://leetcode.com/problems/" + slug + "/",
          title,
        ],
      )
    ).rows[0].id;
    ids.push(id);
    await c.query(
      "insert into public.question_dsa_topics(question_id,topic_id) values($1,$2) on conflict(question_id) do update set topic_id=excluded.topic_id",
      [id, topic],
    );
    await c.query(
      "insert into public.company_question_observations(snapshot_id,company_id,question_id,time_window,frequency,frequency_kind) values($1,$2,$3,'all',80,'percent')",
      [snapshot, company, id],
    );
  }
  await c.query(
    "insert into public.user_question_state(user_id,question_id,status,confidence,next_revision_at) values($1,$2,'attempted',2,now())",
    [owner, ids[0]],
  );
  await c.query(
    "insert into public.notes(user_id,question_id,content,tags) values($1,$2,'Keep my reasoning',array['Intervals'])",
    [owner, ids[0]],
  );
  await c.query("set local role authenticated");
  await c.query("select set_config('prepyard.student_id',$1,true)", [owner]);
  const baseline = {
    username: "fixture_student",
    slugs: ["attend-all-meetings-ii", "unknown-old-question"],
  };
  const settings = await connectAccount(c, baseline);
  assert.equal(settings.enabled, true);
  assert.equal(
    (await c.query("select count(*)::int total from public.account_sync_seen"))
      .rows[0].total,
    2,
  );
  assert.equal(
    (
      await c.query(
        "select status from public.user_question_state where question_id=$1",
        [ids[0]],
      )
    ).rows[0].status,
    "attempted",
  );
  assert.equal(await claimAccountSync(c), null, "baseline starts the cooldown");
  await c.query(
    "update public.account_sync_settings set last_attempt_at=now()-interval '3 minutes'",
  );
  const claim = await claimAccountSync(c);
  assert.ok(claim);
  assert.equal(await claimAccountSync(c), null);
  const next = {
    username: baseline.username,
    slugs: [...baseline.slugs, "attend-all-meetings", "unmatched-new"],
  };
  assert.deepEqual(await applySolvedSnapshot(c, claim, next), {
    cancelled: false,
    matched: 1,
    changed: 1,
  });
  const state = (
    await c.query(
      "select status,confidence,next_revision_at from public.user_question_state where question_id=$1",
      [ids[0]],
    )
  ).rows[0];
  assert.equal(state.status, "solved");
  assert.equal(state.confidence, 2);
  assert.ok(state.next_revision_at);
  assert.deepEqual(
    (
      await c.query(
        "select content,tags from public.notes where question_id=$1",
        [ids[0]],
      )
    ).rows[0],
    { content: "Keep my reasoning", tags: ["Intervals"] },
  );
  assert.equal(
    (
      await c.query(
        "select count(*)::int total from public.user_question_state where question_id=$1",
        [ids[1]],
      )
    ).rows[0].total,
    0,
    "baseline history is never imported",
  );
  const companies = await companySheet(
    c,
    fixture,
    filtersFrom({ q: "Meeting Rooms" }),
  );
  const patterns = await patternQuestions(
    c,
    patternFilters({ q: "Meeting Rooms" }),
  );
  assert.equal(companies.rows.find((q) => q.id === ids[0]).status, "solved");
  assert.equal(patterns.rows.find((q) => q.id === ids[0]).status, "solved");
  await c.query(
    "update public.user_question_state set status='not_started' where question_id=$1",
    [ids[0]],
  );
  assert.equal((await applySolvedSnapshot(c, claim, next)).changed, 0);
  assert.equal(
    (
      await c.query(
        "select status from public.user_question_state where question_id=$1",
        [ids[0]],
      )
    ).rows[0].status,
    "not_started",
  );
  await setAccountEnabled(c, false);
  assert.equal((await applySolvedSnapshot(c, claim, next)).cancelled, true);
  const resumed = await setAccountEnabled(c, true);
  assert.equal(resumed.binding_version, claim.binding_version);
  assert.equal(
    (await connectAccount(c, next)).binding_version,
    claim.binding_version,
    "same account reconnect keeps its baseline",
  );
  await assert.rejects(
    applySolvedSnapshot(c, claim, { username: "wrong_account", slugs: [] }),
    /mismatch/,
  );
  await c.query("select set_config('prepyard.student_id',$1,true)", [other]);
  assert.equal(await accountSettings(c), null);
  assert.equal(
    (await c.query("select count(*)::int total from public.account_sync_seen"))
      .rows[0].total,
    0,
  );
  assert.equal(
    (
      await c.query(
        "delete from public.account_sync_settings returning user_id",
      )
    ).rowCount,
    0,
  );
  await c.query("savepoint denied");
  await assert.rejects(
    c.query(
      "insert into public.account_sync_settings(user_id,provider,username) values($1,'gfg','stolen')",
      [owner],
    ),
    (error) => error.code === "42501",
  );
  await c.query("rollback to savepoint denied");
  await c.query("select set_config('prepyard.student_id',$1,true)", [owner]);
  const changedAccount = await connectAccount(c, {
    username: "new_account",
    slugs: [],
  });
  assert.notEqual(changedAccount.binding_version, claim.binding_version);
  assert.equal((await applySolvedSnapshot(c, claim, next)).cancelled, true);
  await disconnectAccount(c);
  assert.equal(await accountSettings(c), null);
  assert.equal(
    (await c.query("select count(*)::int total from public.account_sync_seen"))
      .rows[0].total,
    0,
  );
  assert.equal(
    (
      await c.query("select content from public.notes where question_id=$1", [
        ids[0],
      ])
    ).rows[0].content,
    "Keep my reasoning",
  );
  await c.query("reset role; set local role anon; savepoint denied_anon");
  await assert.rejects(
    c.query("select * from public.account_sync_settings"),
    (error) => error.code === "42501",
  );
  await c.query("rollback to savepoint denied_anon");
  console.log(
    "Account sync database checks passed: baseline, free replacements, shared completion, owner policies, cooldown, stale requests, pause and idempotency.",
  );
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}
