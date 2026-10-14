import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import {
  companySheet,
  companiesSql,
  filtersFrom,
} from "../../src/features/catalogue/queries.mjs";
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
  const student = randomUUID(),
    slug = "difficulty-" + randomUUID();
  await c.query("insert into private.students(id) values($1)", [student]);
  const company = (
    await c.query(
      "insert into public.companies(slug,name) values($1,'Difficulty test') returning id",
      [slug],
    )
  ).rows[0].id;
  const source = (
    await c.query(
      "insert into public.sources(slug,name,url,adapter,attribution,reuse_status,is_public,enabled) values($1,'Difficulty test','https://example.com','test','Test','approved',true,true) returning id",
      [slug],
    )
  ).rows[0].id;
  const snapshot = (
    await c.query(
      "insert into public.source_snapshots(source_id,revision,status,published_at) values($1,'current','published',now()) returning id",
      [source],
    )
  ).rows[0].id;
  const archived = (
    await c.query(
      "insert into public.source_snapshots(source_id,revision,status,published_at) values($1,'old','archived',now()) returning id",
      [source],
    )
  ).rows[0].id;
  const platform = (
    await c.query("select id from public.platforms where slug='leetcode'")
  ).rows[0].id;
  const ids = [];
  for (let i = 0; i < 59; i++) {
    const key = "difficulty-" + randomUUID();
    const difficulty =
      i < 52 ? "easy" : i < 54 ? "medium" : i < 57 ? "hard" : null;
    const q = (
      await c.query(
        "insert into public.questions(platform_id,external_id,canonical_url,title,difficulty,is_listed) values($1,$2,$3,$4,$5,true) returning id",
        [
          platform,
          key,
          "https://leetcode.com/problems/" + key,
          "Difficulty question " + String(i).padStart(2, "0"),
          difficulty,
        ],
      )
    ).rows[0].id;
    ids.push(q);
    await c.query(
      "insert into public.company_question_observations(snapshot_id,company_id,question_id,time_window,frequency,frequency_kind) values($1,$2,$3,'all',90,'percent')",
      [i === 58 ? archived : snapshot, company, q],
    );
    if (i === 0 || i === 1 || i === 52)
      await c.query(
        "insert into public.company_question_observations(snapshot_id,company_id,question_id,time_window,frequency,frequency_kind) values($1,$2,$3,'30d',90,'percent')",
        [snapshot, company, q],
      );
  }
  for (const q of [ids[0], ids[54]])
    await c.query(
      "insert into public.user_question_state(user_id,question_id,status) values($1,$2,'solved')",
      [student, q],
    );
  await c.query("set local role authenticated");
  await c.query("select set_config('prepyard.student_id',$1,true)", [student]);
  const directory = (await c.query(companiesSql)).rows.find(
    (q) => q.slug === slug,
  );
  assert.equal(
    directory.question_count,
    58,
    "Overlapping windows do not duplicate questions and archived snapshots are excluded",
  );
  assert.deepEqual(
    [directory.easy_count, directory.medium_count, directory.hard_count],
    [52, 2, 3],
  );
  assert.equal(directory.solved_count, 2);
  let sheet = await companySheet(c, slug, filtersFrom());
  assert.equal(sheet.total, 58);
  assert.equal(sheet.rows.length, 50);
  assert.equal(sheet.pages, 2);
  assert.deepEqual(
    [sheet.easy_count, sheet.medium_count, sheet.hard_count],
    [52, 2, 3],
    "Summary counts include every page, keeping unrated separate",
  );
  sheet = await companySheet(c, slug, filtersFrom({ page: "2" }));
  assert.equal(sheet.rows.length, 8);
  assert.equal(sheet.easy_count, 52);
  sheet = await companySheet(c, slug, filtersFrom({ window: "30d" }));
  assert.equal(sheet.total, 3);
  assert.deepEqual(
    [sheet.easy_count, sheet.medium_count, sheet.hard_count],
    [2, 1, 0],
  );
  sheet = await companySheet(c, slug, filtersFrom({ difficulty: "hard" }));
  assert.equal(sheet.total, 3);
  assert.deepEqual(
    [sheet.easy_count, sheet.medium_count, sheet.hard_count],
    [0, 0, 3],
  );
  sheet = await companySheet(c, slug, filtersFrom({ progress: "solved" }));
  assert.equal(sheet.total, 2);
  assert.deepEqual(
    [sheet.easy_count, sheet.medium_count, sheet.hard_count],
    [1, 0, 1],
  );
  sheet = await companySheet(
    c,
    slug,
    filtersFrom({ q: "no matching problem" }),
  );
  assert.equal(sheet.total, 0);
  assert.deepEqual(
    [sheet.easy_count, sheet.medium_count, sheet.hard_count],
    [0, 0, 0],
  );
  await c.query("rollback");
  console.log(
    "PASS: distinct company difficulty totals, all-page summaries, filters/windows/progress, zero matches, unrated metadata and archived-data exclusion.",
  );
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}
