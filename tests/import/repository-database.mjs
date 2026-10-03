import pg from "pg";
import { performance } from "node:perf_hooks";
import assert from "node:assert/strict";
import { loadRepository } from "../../scripts/import/adapters/repository.mjs";
import { publishRepository } from "../../scripts/import/publish/repository.mjs";
import {
  companiesSql,
  companySheet,
  filtersFrom,
} from "../../src/features/catalogue/queries.mjs";
const { Client } = pg;
const target = new URL(
  process.env.PREPYARD_AUTH_TEST_DATABASE_URL || "https://invalid",
);
if (
  !["localhost", "127.0.0.1"].includes(target.hostname) ||
  !target.pathname.endsWith("_test")
)
  throw new Error("Use an isolated loopback _test database.");
if (!process.env.REPOSITORY_DIRECTORY)
  throw new Error("Set REPOSITORY_DIRECTORY to the extracted pinned archive.");
const client = new Client({ connectionString: target.href });
await client.connect();
const data = await loadRepository(process.env.REPOSITORY_DIRECTORY);
try {
  assert.equal(data.companies.length, 656);
  assert.equal(data.questions.length, 3358);
  assert.equal(data.observations.length, 39353);
  const start = performance.now();
  console.log(await publishRepository(client, data));
  console.log(
    "Import seconds: " + ((performance.now() - start) / 1000).toFixed(2),
  );
  const state = async () =>
    JSON.stringify(
      (
        await client.query(
          "select count(*)::int as observations,(select count(*) from public.questions) as questions,(select count(*) from public.companies) as companies,(select max(published_at) from public.source_snapshots) as last_publication from public.company_question_observations",
        )
      ).rows,
    );
  const before = await state();
  await publishRepository(client, data);
  assert.equal(await state(), before);
  const bad = structuredClone(data);
  bad.observations[0].frequency = 12;
  await assert.rejects(publishRepository(client, bad), /do not match/);
  assert.equal(await state(), before);
  await client.query("begin");
  await client.query("set local role authenticated");
  await client.query(
    "select set_config('prepyard.student_id','11111111-1111-4111-8111-111111111111',true)",
  );
  const queryStart = performance.now();
  const companies = (await client.query(companiesSql)).rows;
  assert.equal(companies.length, 656);
  assert.equal(
    companies.some((c) => c.slug === "amazon"),
    true,
  );
  const sheet = await companySheet(client, "amazon", filtersFrom());
  assert.ok(sheet.total > 50);
  assert.equal(sheet.rows.length, 50);
  assert.ok(
    sheet.rows.every((r) => r.status === "not_started" && !r.bookmarked),
  );
  console.log(
    "Authenticated directory and Amazon sheet seconds: " +
      ((performance.now() - queryStart) / 1000).toFixed(2),
  );
  await client.query("rollback");
  console.log(
    "All-company counts, exact replay, conflict rollback and student queries passed.",
  );
} finally {
  await client.query("rollback");
  await client.end();
}
