import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { dashboardPractice } from "../../src/features/dashboard/practice.mjs";

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
  const first = randomUUID(),
    second = randomUUID(),
    slug = "dashboard-" + randomUUID();
  await c.query("insert into private.students(id) values($1),($2)", [
    first,
    second,
  ]);
  const platform = (
    await c.query(
      "insert into public.platforms(slug,name,base_url) values('leetcode','LeetCode','https://leetcode.com') on conflict(slug) do update set name=excluded.name returning id",
    )
  ).rows[0].id;
  const topic = (
    await c.query(
      "insert into public.dsa_topics(slug,name,position) values('arrays','Arrays',1) on conflict(slug) do update set name=excluded.name returning id",
    )
  ).rows[0].id;
  const company = (
    await c.query(
      "insert into public.companies(slug,name) values($1,'Dashboard test') returning id",
      [slug],
    )
  ).rows[0].id;
  const source = (
    await c.query(
      "insert into public.sources(slug,name,url,adapter,attribution,reuse_status,is_public,enabled) values($1,'Dashboard test','https://example.com','test','Test','approved',true,true) returning id",
      [slug],
    )
  ).rows[0].id;
  const snapshot = (
    await c.query(
      "insert into public.source_snapshots(source_id,revision,status,published_at) values($1,'current','published',now()) returning id",
      [source],
    )
  ).rows[0].id;
  const ids = [];
  for (let i = 0; i < 8; i++) {
    const problem =
      i === 6
        ? "meeting-rooms-ii"
        : i === 7
          ? "robot-room-cleaner"
          : slug + "-" + i;
    const id = (
      await c.query(
        "insert into public.questions(platform_id,external_id,canonical_url,title,difficulty,is_listed) values($1,$2,$3,$4,'medium',$5) returning id",
        [
          platform,
          slug + "-" + i,
          "https://leetcode.com/problems/" + problem,
          "Dashboard " + i,
          i !== 5,
        ],
      )
    ).rows[0].id;
    ids.push(id);
    await c.query(
      "insert into public.user_question_state(user_id,question_id,status,confidence,next_revision_at,updated_at) values($1,$2,'solved',$3,now()+make_interval(days=>$4),now()+make_interval(secs=>$5))",
      [first, id, (i % 4) + 1, i === 4 ? 1 : -10 + i, i],
    );
    if (i === 0 || i === 6)
      await c.query(
        "insert into public.question_dsa_topics(question_id,topic_id) values($1,$2)",
        [id, topic],
      );
    if (i === 1)
      await c.query(
        "insert into public.company_question_observations(snapshot_id,company_id,question_id,time_window,frequency,frequency_kind) values($1,$2,$3,'30d',90,'percent')",
        [snapshot, company, id],
      );
  }
  const neetcode = (
    await c.query(
      "insert into public.platforms(slug,name,base_url) values('neetcode','NeetCode','https://neetcode.io') on conflict(slug) do update set name=excluded.name returning id",
    )
  ).rows[0].id;
  const withdrawnIds = [];
  for (const [p, url] of [
    [platform, "https://leetcode.com/problems/walls-and-gates/"],
    [neetcode, "https://neetcode.io/problems/" + slug + "/question"],
  ]) {
    const id = (
      await c.query(
        "insert into public.questions(platform_id,external_id,canonical_url,title,difficulty,is_listed) values($1,$2,$3,'Withdrawn question','medium',true) returning id",
        [p, randomUUID(), url],
      )
    ).rows[0].id;
    withdrawnIds.push(id);
    await c.query(
      "insert into public.user_question_state(user_id,question_id,status,confidence,next_revision_at,updated_at) values($1,$2,'solved',1,now()-interval '50 days',now()+interval '1 day')",
      [first, id],
    );
  }
  await c.query(
    "insert into public.user_question_state(user_id,question_id,status,confidence,next_revision_at) values($1,$2,'attempted',4,now()-interval '40 days')",
    [second, ids[4]],
  );
  await c.query("set local role authenticated");
  const identity = (id) =>
    c.query("select set_config('prepyard.student_id',$1,true)", [id]);
  let reads = 0;
  const measured = {
    query: (...args) => {
      reads++;
      return c.query(...args);
    },
  };
  await identity(first);
  const result = await dashboardPractice(measured);
  assert.equal(reads, 1, "Recent and due rows use one read");
  assert.equal(result.recent.length, 5);
  assert.ok(
    ![...result.recent, ...result.revisions].some((row) =>
      withdrawnIds.includes(row.id),
    ),
    "NeetCode and withdrawn alternatives stay out of dashboard queues",
  );
  assert.equal(result.revisions.length, 3);
  assert.deepEqual(
    result.revisions.map((row) => row.id),
    ids.slice(0, 3),
    "Earliest due first, excluding future revisions",
  );
  assert.equal(result.revisions[0].revision_confidence, 1);
  assert.equal(result.revisions[0].practice_path, "/patterns");
  assert.equal(
    result.revisions[1].practice_path,
    "/companies/" + slug + "?window=30d",
    "Company-only question preserves an available window",
  );
  assert.equal(
    result.revisions[2].practice_path,
    null,
    "Standalone question falls back to its exact platform URL",
  );
  assert.equal(
    result.recent[0].title,
    "Meeting Rooms II",
    "Free alternatives keep the reviewed title/link",
  );
  assert.equal(result.recent[0].id, ids[6]);
  assert.equal(
    result.recent[0].canonical_url,
    "https://www.geeksforgeeks.org/problems/attend-all-meetings-ii/1",
  );
  assert.ok(
    ![...result.recent, ...result.revisions].some((row) =>
      [ids[5], ids[7]].includes(row.id),
    ),
    "Hidden and unresolved paid questions are withheld",
  );
  await identity(second);
  const other = await dashboardPractice(c);
  assert.deepEqual(
    other.recent.map((row) => row.id),
    [ids[4]],
  );
  assert.deepEqual(
    other.revisions.map((row) => row.id),
    [ids[4]],
  );
  assert.equal(
    other.revisions[0].revision_confidence,
    4,
    "The other student's rating remains isolated",
  );
  await c.query(
    "update public.user_question_state set next_revision_at=now()+interval '1 day' where question_id=$1",
    [ids[4]],
  );
  assert.deepEqual(
    (await dashboardPractice(c)).revisions,
    [],
    "Fresh state removes completed rescheduling from the due queue",
  );
  await c.query(
    "delete from public.user_question_state where user_id=private.student_id()",
  );
  assert.deepEqual(
    await dashboardPractice(c),
    { recent: [], revisions: [] },
    "New accounts have an empty dashboard, never another student's history",
  );
  console.log(
    "PASS: dashboard due ordering, limits, confidence, owner isolation, free alternatives, destinations/windows, fresh and empty states.",
  );
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}
