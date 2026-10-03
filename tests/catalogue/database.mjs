import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { loadCompanySnapshot } from "../../scripts/import/adapters/company-csv.mjs";
import { publishFixture } from "../../scripts/import/publish/publish-fixture.mjs";
import {
  companySheet,
  companiesSql,
  filtersFrom,
} from "../../src/features/catalogue/queries.mjs";
const url = new URL(
  process.env.PREPYARD_AUTH_TEST_DATABASE_URL || "https://invalid",
);
if (
  !["127.0.0.1", "localhost"].includes(url.hostname) ||
  !url.pathname.endsWith("_test")
)
  throw new Error("Use an isolated loopback _test database.");
const client = new pg.Client({ connectionString: url.href });
await client.connect();
const snapshot = await loadCompanySnapshot(
  fileURLToPath(
    new URL(
      "../../tests/fixtures/cs-satyam/1kosmos/manifest.json",
      import.meta.url,
    ),
  ),
);
const expected = JSON.parse(
  await readFile(
    new URL("../fixtures/cs-satyam/1kosmos/expected.json", import.meta.url),
    "utf8",
  ),
);
try {
  await publishFixture(client, snapshot, expected);
  const state = async () =>
    JSON.stringify(
      (
        await client.query(
          "select id,status,published_at from public.source_snapshots order by id",
        )
      ).rows,
    );
  const before = await state();
  await publishFixture(client, snapshot, expected);
  assert.equal(await state(), before);
  const bad = structuredClone(expected);
  bad.questions[0].title = "Wrong";
  await assert.rejects(publishFixture(client, snapshot, bad));
  assert.equal(await state(), before);
  await client.query("begin");
  const id = randomUUID();
  await client.query("insert into private.students(id,email) values($1,$2)", [
    id,
    "catalogue@example.test",
  ]);
  const extra = await client.query(
    `insert into public.questions(platform_id,external_id,canonical_url,title,difficulty,original_difficulty,is_listed) select id,'test-low','https://leetcode.com/problems/test-low','A lower frequency question','easy','Easy',true from public.platforms where slug='leetcode' returning id`,
  );
  await client.query(
    `insert into public.company_question_observations(snapshot_id,company_id,question_id,time_window,frequency,frequency_kind) select ss.id,c.id,$1,'all',20,'percent' from public.source_snapshots ss join public.sources s on s.id=ss.source_id cross join public.companies c where s.slug='cs-satyam-1kosmos' and c.slug='1kosmos'`,
    [extra.rows[0].id],
  );
  await client.query("set local role authenticated");
  await client.query("select set_config('prepyard.student_id',$1,true)", [id]);
  assert.equal(
    (await client.query(companiesSql)).rows.find((c) => c.slug === "1kosmos")
      .question_count,
    2,
  );
  const sheet = await companySheet(client, "1kosmos", filtersFrom());
  assert.equal(sheet.rows.length, 2);
  assert.equal(sheet.rows[0].title, expected.questions[0].title);
  assert.equal(sheet.rows[0].frequency, 100);
  assert.equal(sheet.rows[0].companies[0].name, "1Kosmos");
  assert.equal(
    (
      await companySheet(
        client,
        "1kosmos",
        filtersFrom({ sort: "frequency-asc" }),
      )
    ).rows[0].frequency,
    20,
  );
  assert.equal(
    (await companySheet(client, "1kosmos", filtersFrom({ sort: "title" })))
      .rows[0].title,
    "A lower frequency question",
  );
  assert.equal(
    (
      await companySheet(
        client,
        "1kosmos",
        filtersFrom({ difficulty: "medium" }),
      )
    ).total,
    1,
  );
  assert.equal(
    (await companySheet(client, "1kosmos", filtersFrom({ difficulty: "hard" })))
      .total,
    0,
  );
  assert.equal(
    (await companySheet(client, "1kosmos", filtersFrom({ q: "BLACK" }))).total,
    1,
  );
  assert.equal(
    (await companySheet(client, "1kosmos", filtersFrom({ q: "%' OR true --" })))
      .total,
    0,
  );
  assert.equal(
    (
      await companySheet(
        client,
        "1kosmos",
        filtersFrom({ window: "older-than-180d" }),
      )
    ).total,
    1,
  );
  assert.equal(
    (await companySheet(client, "1kosmos", filtersFrom({ window: "30d" })))
      .total,
    0,
  );
  assert.equal(await companySheet(client, "missing", filtersFrom()), null);
  assert.equal(
    (await companySheet(client, "1kosmos", filtersFrom({ page: "9999" }))).page,
    1,
  );
  assert.ok(!JSON.stringify(sheet).includes("snapshot_id"));
  assert.ok(!JSON.stringify(sheet).includes("a09d3bae"));
  await client.query("rollback");
  console.log(
    "Publication replay/rollback and authenticated catalogue search, filters, sort, windows, pagination, tags and safe projection passed.",
  );
} finally {
  await client.query("rollback");
  await client.end();
}
