import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { createCatalogueCache } from "../../src/features/catalogue/cache.mjs";
import {
  companyMetadata,
  companyCatalogueSql,
  companySolvedCountsSql,
  companySheet,
  filtersFrom,
} from "../../src/features/catalogue/queries.mjs";
import {
  patternMetadata,
  patternOverview,
  patternFilters,
} from "../../src/features/patterns/queries.mjs";

const target = new URL(
  process.env.PREPYARD_AUTH_TEST_DATABASE_URL || "https://invalid",
);
if (
  !["localhost", "127.0.0.1"].includes(target.hostname) ||
  !target.pathname.endsWith("_test")
)
  throw Error("Use a migrated isolated loopback _test database");
const client = new pg.Client({ connectionString: target.href });
try {
  await client.connect();
  await client.query("begin");
  const first = randomUUID(),
    second = randomUUID(),
    slug = "performance-" + randomUUID();
  await client.query("insert into private.students(id) values($1),($2)", [
    first,
    second,
  ]);
  const company = (
    await client.query(
      "insert into public.companies(slug,name) values($1,'Performance test') returning id",
      [slug],
    )
  ).rows[0].id;
  const source = (
    await client.query(
      "insert into public.sources(slug,name,url,adapter,attribution,reuse_status,is_public,enabled) values($1,'Performance test','https://example.com','test','Test','approved',true,true) returning id",
      [slug],
    )
  ).rows[0].id;
  const snapshot = (
    await client.query(
      "insert into public.source_snapshots(source_id,revision,status,published_at) values($1,'current','published',now()) returning id",
      [source],
    )
  ).rows[0].id;
  const platform = (
    await client.query(
      "insert into public.platforms(slug,name,base_url) values('leetcode','LeetCode','https://leetcode.com') on conflict(slug) do update set name=excluded.name returning id",
    )
  ).rows[0].id;
  const topic = (
    await client.query(
      "insert into public.dsa_topics(slug,name,position) values('arrays','Arrays',1) on conflict(slug) do update set name=excluded.name returning id",
    )
  ).rows[0].id;
  const ids = [];
  for (let i = 0; i < 2; i++) {
    const id = (
      await client.query(
        "insert into public.questions(platform_id,external_id,canonical_url,title,difficulty,is_listed) values($1,$2,$3,$4,$5,true) returning id",
        [
          platform,
          slug + i,
          "https://leetcode.com/problems/" + slug + i,
          "Performance " + i,
          i ? "medium" : "easy",
        ],
      )
    ).rows[0].id;
    ids.push(id);
    await client.query(
      "insert into public.company_question_observations(snapshot_id,company_id,question_id,time_window,frequency,frequency_kind) values($1,$2,$3,'all',$4,'percent')",
      [snapshot, company, id, i ? 40 : 90],
    );
    await client.query(
      "insert into public.question_dsa_topics(question_id,topic_id) values($1,$2)",
      [id, topic],
    );
  }
  await client.query(
    "insert into public.user_question_state(user_id,question_id,status,confidence,next_revision_at) values($1,$2,'solved',2,now()),($3,$4,'attempted',4,now()+interval '1 day')",
    [first, ids[0], second, ids[1]],
  );
  await client.query(
    "insert into public.notes(user_id,question_id,content) values($1,$2,'First private note'),($3,$4,'Second private note')",
    [first, ids[0], second, ids[1]],
  );
  await client.query("set local role authenticated");
  const identity = async (id) =>
    client.query("select set_config('prepyard.student_id',$1,true)", [id]);
  const cache = createCatalogueCache();
  let queries = 0,
    loads = 0;
  const measured = {
    query: (...args) => {
      queries++;
      return client.query(...args);
    },
  };
  const metadata = (c, name) =>
    cache.read("company:" + name, async () => {
      loads++;
      return companyMetadata(c, name);
    });
  const directory = () =>
    cache.read(
      "directory",
      async () => (await measured.query(companyCatalogueSql)).rows,
    );
  const pattern = (c, f) =>
    cache.read("pattern:" + JSON.stringify([f.pattern, f.collection]), () =>
      patternMetadata(c, f),
    );
  await identity(first);
  const one = await companySheet(measured, slug, filtersFrom(), metadata);
  assert.equal(queries, 2);
  assert.equal(one.solved, 1);
  assert.deepEqual(
    one.rows.map((row) => [row.status, row.has_note, row.revision_confidence]),
    [
      ["solved", true, 2],
      ["not_started", false, null],
    ],
  );
  const shared = (await directory()).find((row) => row.id === company);
  assert.equal(shared.question_count, 2);
  assert.equal(Object.hasOwn(shared, "solved_count"), false);
  assert.equal(
    (await measured.query(companySolvedCountsSql)).rows.find(
      (row) => row.id === company,
    ).solved_count,
    1,
  );
  const overviewOne = await patternOverview(
    measured,
    patternFilters({ q: "Performance" }),
    pattern,
  );
  assert.equal(overviewOne.solved, 1);
  await identity(second);
  queries = 0;
  const two = await companySheet(measured, slug, filtersFrom(), metadata);
  assert.equal(queries, 1);
  assert.equal(loads, 1);
  assert.equal(two.solved, 0);
  assert.deepEqual(
    two.rows.map((row) => [row.status, row.has_note, row.revision_confidence]),
    [
      ["not_started", false, null],
      ["attempted", true, 4],
    ],
  );
  assert.deepEqual(
    (await directory()).find((row) => row.id === company),
    shared,
  );
  assert.equal(
    (await measured.query(companySolvedCountsSql)).rows.some(
      (row) => row.id === company,
    ),
    false,
  );
  const overviewTwo = await patternOverview(
    measured,
    patternFilters({ q: "Performance" }),
    pattern,
  );
  assert.equal(overviewTwo.solved, 0);
  assert.deepEqual(overviewOne.topics, overviewTwo.topics);
  // A personal write must become visible immediately, even with warm metadata.
  await client.query(
    "update public.user_question_state set status='solved' where question_id=$1",
    [ids[1]],
  );
  assert.equal(
    (await companySheet(measured, slug, filtersFrom(), metadata)).solved,
    1,
  );
  const clamped = await companySheet(
    measured,
    slug,
    filtersFrom({ page: "999" }),
    metadata,
  );
  assert.equal(clamped.page, 1);
  assert.equal(clamped.rows.length, 2);
  const empty = await companySheet(
    measured,
    slug,
    filtersFrom({ q: "No match", page: "999" }),
    metadata,
  );
  assert.equal(empty.page, 1);
  assert.equal(empty.pages, 1);
  assert.equal(empty.total, 0);
  assert.deepEqual(empty.rows, []);
  assert.equal(
    await companySheet(measured, "absent-" + slug, filtersFrom(), metadata),
    null,
  );
  console.log(
    "PASS: cold/warm reads, shared catalogue, fresh owner progress, note/revision isolation, pattern counts, clamped/empty pagination.",
  );
} finally {
  await client.query("rollback").catch(() => {});
  await client.end();
}
