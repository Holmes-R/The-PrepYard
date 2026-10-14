import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import {
  companySheet,
  companiesSql,
  filtersFrom,
} from "../../src/features/catalogue/queries.mjs";
import {
  patternOverview,
  patternQuestions,
  patternFilters,
} from "../../src/features/patterns/queries.mjs";
import { studentNotes } from "../../src/features/notes/queries.mjs";
const target = new URL(
  process.env.PREPYARD_AUTH_TEST_DATABASE_URL || "https://invalid",
);
if (
  !["localhost", "127.0.0.1"].includes(target.hostname) ||
  !target.pathname.endsWith("_test")
)
  throw Error("Use a migrated isolated loopback _test database");
const c = new pg.Client({ connectionString: target.href });
try {
  await c.connect();
  await c.query("begin");
  const user = randomUUID(),
    slug = "practice-" + randomUUID();
  await c.query("insert into private.students(id) values($1)", [user]);
  const platform = (
    await c.query(
      "insert into public.platforms(slug,name,base_url) values('leetcode','LeetCode','https://leetcode.com') on conflict(slug) do update set name=excluded.name returning id",
    )
  ).rows[0].id;
  const company = (
    await c.query(
      "insert into public.companies(slug,name) values($1,'Practice test') returning id",
      [slug],
    )
  ).rows[0].id;
  const source = (
    await c.query(
      "insert into public.sources(slug,name,url,adapter,attribution,reuse_status,is_public,enabled) values($1,'Practice test','https://example.com','test','Test','approved',true,true) returning id",
      [slug],
    )
  ).rows[0].id;
  const snapshot = (
    await c.query(
      "insert into public.source_snapshots(source_id,revision,status,published_at) values($1,'practice','published',now()) returning id",
      [source],
    )
  ).rows[0].id;
  const topic = (
    await c.query(
      "insert into public.dsa_topics(slug,name,position) values('arrays','Arrays',1) on conflict(slug) do update set name=excluded.name returning id",
    )
  ).rows[0].id;
  const ids = [];
  for (const [external, title, url, difficulty] of [
    ["253", "Meeting Rooms II", "meeting-rooms-ii", "medium"],
    ["489", "Robot Room Cleaner", "robot-room-cleaner", "hard"],
    ["1", "Two Sum", "two-sum", "easy"],
  ]) {
    const id = (
      await c.query(
        "insert into public.questions(platform_id,external_id,canonical_url,title,difficulty,is_listed) values($1,$2,$3,$4,$5,true) on conflict(platform_id,external_id) do update set canonical_url=excluded.canonical_url,title=excluded.title,difficulty=excluded.difficulty,is_listed=true returning id",
        [
          platform,
          external,
          "https://leetcode.com/problems/" + url + "/",
          title,
          difficulty,
        ],
      )
    ).rows[0].id;
    ids.push(id);
    await c.query(
      "insert into public.company_question_observations(snapshot_id,company_id,question_id,time_window,frequency,frequency_kind) values($1,$2,$3,'all',75,'percent')",
      [snapshot, company, id],
    );
    await c.query(
      "insert into public.question_dsa_topics(question_id,topic_id) values($1,$2) on conflict(question_id) do update set topic_id=excluded.topic_id",
      [id, topic],
    );
  }
  const neetcode = (
    await c.query(
      "insert into public.platforms(slug,name,base_url) values('neetcode','NeetCode','https://neetcode.io') on conflict(slug) do update set name=excluded.name returning id",
    )
  ).rows[0].id;
  for (const [p, external, title, url] of [
    [
      platform,
      "286",
      "Walls and Gates",
      "https://leetcode.com/problems/walls-and-gates/",
    ],
    [
      neetcode,
      slug,
      "NeetCode removed native",
      "https://www.neetcode.io/problems/" + slug + "/question",
    ],
    [
      platform,
      slug + "-mislabelled",
      "NeetCode removed mislabelled",
      "https://neetcode.io/problems/" + slug + "/question",
    ],
  ]) {
    const id = (
      await c.query(
        "insert into public.questions(platform_id,external_id,canonical_url,title,difficulty,is_listed) values($1,$2,$3,$4,'medium',true) on conflict(platform_id,external_id) do update set canonical_url=excluded.canonical_url,title=excluded.title,is_listed=true returning id",
        [p, external, url, title],
      )
    ).rows[0].id;
    ids.push(id);
    await c.query(
      "insert into public.company_question_observations(snapshot_id,company_id,question_id,time_window,frequency,frequency_kind) values($1,$2,$3,'all',75,'percent')",
      [snapshot, company, id],
    );
    await c.query(
      "insert into public.question_dsa_topics(question_id,topic_id) values($1,$2) on conflict(question_id) do update set topic_id=excluded.topic_id",
      [id, topic],
    );
  }
  for (const id of ids.filter((_, i) => i !== 2)) {
    await c.query(
      "insert into public.user_question_state(user_id,question_id,status,confidence,next_revision_at) values($1,$2,'solved',2,now())",
      [user, id],
    );
    await c.query(
      "insert into public.notes(user_id,question_id,content,tags) values($1,$2,'Owner note',array['Retry'])",
      [user, id],
    );
  }
  await c.query("select set_config('prepyard.student_id',$1,true)", [user]);
  await c.query("set local role authenticated");
  const companyRows = await companySheet(
    c,
    slug,
    filtersFrom({ order: "title-asc" }),
  );
  assert.equal(companyRows.total, 2);
  assert.equal(companyRows.solved, 1);
  assert.deepEqual(
    [companyRows.easy_count, companyRows.medium_count, companyRows.hard_count],
    [1, 1, 0],
  );
  assert.equal(companyRows.rows[0].title, "Meeting Rooms II");
  assert.equal(companyRows.rows[0].id, ids[0]);
  assert.equal(companyRows.rows[0].has_note, true);
  assert.ok(!Object.hasOwn(companyRows.rows[0], "original_url"));
  const search = await companySheet(c, slug, filtersFrom({ q: "Meeting" }));
  assert.equal(search.total, 1);
  assert.equal(search.rows[0].platform, "GeeksforGeeks");
  const directory = (await c.query(companiesSql)).rows.find(
    (r) => r.slug === slug,
  );
  assert.equal(directory.question_count, 2);
  assert.equal(directory.hard_count, 0);
  const patterns = await patternQuestions(
    c,
    patternFilters({ q: "Meeting", topic: "arrays" }),
  );
  assert.equal(patterns.total, 1);
  assert.equal(patterns.rows[0].id, ids[0]);
  const overview = await patternOverview(
    c,
    patternFilters({ q: "Robot Room Cleaner" }),
  );
  assert.equal(overview.total, 0);
  const notebook = await studentNotes(c, 1, "Meeting");
  assert.equal(notebook.total, 1);
  assert.equal(notebook.rows[0].id, ids[0]);
  const allNotes = await studentNotes(c);
  assert.equal(allNotes.total, 5);
  assert.equal(allNotes.rows.find((n) => n.id === ids[1]).canonical_url, "");
  for (const q of ["Walls and Gates", "NeetCode removed"]) {
    assert.equal((await companySheet(c, slug, filtersFrom({ q }))).total, 0);
    assert.equal(
      (await patternQuestions(c, patternFilters({ q, topic: "arrays" }))).total,
      0,
    );
    assert.equal((await patternOverview(c, patternFilters({ q }))).total, 0);
  }
  for (const id of ids.slice(3)) {
    assert.equal(allNotes.rows.find((n) => n.id === id).canonical_url, "");
    assert.equal(
      (
        await c.query(
          "select status from public.user_question_state where question_id=$1",
          [id],
        )
      ).rows[0].status,
      "solved",
    );
  }
  const retained = (
    await c.query(
      "select status,confidence from public.user_question_state where question_id=$1",
      [ids[1]],
    )
  ).rows[0];
  assert.deepEqual(retained, { status: "solved", confidence: 2 });
  console.log(
    "Free-practice database checks passed: owner state, replacements, search, counts, sorting, visibility and notes.",
  );
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}
