// Called by the guarded disposable database runner, after policy tests.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCompanySnapshot } from "../../scripts/import/adapters/company-csv.mjs";
import { toStagingSql } from "../../scripts/import/publish/stage-sql.mjs";
if (process.env.PREPYARD_DATABASE_TESTS !== "1")
  throw new Error(
    "Use pnpm db:test; this suite writes only to its disposable database.",
  );
const root = fileURLToPath(new URL("../../", import.meta.url));
const snapshot = await loadCompanySnapshot(
  path.join(root, "tests/fixtures/cs-satyam/1kosmos/manifest.json"),
);
const expected = JSON.parse(
  await readFile(
    path.join(root, "tests/fixtures/cs-satyam/1kosmos/expected.json"),
    "utf8",
  ),
);
const directory = await mkdtemp(path.join(tmpdir(), "prepyard-sql-"));
function run(args, success = true) {
  const result = spawnSync(
    process.env.PSQL_BIN || "psql",
    ["-X", "-v", "ON_ERROR_STOP=1", "-At", ...args],
    { encoding: "utf8", env: process.env },
  );
  if (result.error) throw result.error;
  if (success && result.status !== 0) throw new Error(result.stderr);
  if (!success && result.status === 0)
    throw new Error("Expected SQL rejection");
  return result;
}
async function apply(data, success = true) {
  const file = path.join(directory, "stage.sql");
  await writeFile(file, toStagingSql(data));
  return run(["-f", file], success);
}
try {
  await apply(snapshot);
  const before = run([
    "-c",
    "select id from public.source_snapshots",
  ]).stdout.trim();
  await apply(snapshot);
  assert.equal(
    run(["-c", "select id from public.source_snapshots"]).stdout.trim(),
    before,
  );
  const actual = JSON.parse(
    run([
      "-c",
      `select json_build_object(
    'questions',(select json_agg(json_build_object('external_id',external_id,'canonical_url',canonical_url,'title',title,'difficulty',difficulty,'original_difficulty',original_difficulty) order by external_id) from public.questions),
    'observations',(select json_agg(json_build_object('external_id',q.external_id,'time_window',o.time_window,'frequency',o.frequency,'frequency_kind',o.frequency_kind,'source_rank',o.source_rank,'acceptance_percent',o.acceptance_percent) order by o.time_window,q.external_id) from public.company_question_observations o join public.questions q on q.id=o.question_id))`,
    ]).stdout.trim(),
  );
  assert.deepEqual(actual.questions, expected.questions);
  assert.deepEqual(actual.observations, expected.observations);
  assert.equal(
    run(["-c", "select status from public.source_snapshots"]).stdout.trim(),
    "staged",
  );
  assert.equal(
    run([
      "-c",
      "select reuse_status || ':' || enabled::text || ':' || is_public::text from public.sources",
    ]).stdout.trim(),
    "pending:false:false",
  );
  assert.equal(
    run(["-c", "set role anon; select count(*) from public.questions"])
      .stdout.trim()
      .split("\n")
      .at(-1),
    "0",
  );
  const altered = structuredClone(snapshot);
  altered.observations[0].frequency = 50;
  assert.match((await apply(altered, false)).stderr, /Observation conflict/);
  assert.equal(
    run([
      "-c",
      "select min(frequency) from public.company_question_observations",
    ]).stdout.trim(),
    "100",
  );
  const titleConflict = structuredClone(snapshot);
  titleConflict.questions[0].title = "Conflicting title";
  assert.match(
    (await apply(titleConflict, false)).stderr,
    /Question metadata conflict/,
  );
  assert.equal(
    run(["-c", "select title from public.questions"]).stdout.trim(),
    expected.questions[0].title,
  );
  run(["-c", "update public.source_snapshots set status='validated'"]);
  assert.match((await apply(snapshot, false)).stderr, /non-staged snapshot/);
  assert.equal(
    run(["-c", "select status from public.source_snapshots"]).stdout.trim(),
    "validated",
  );
  console.log(
    "Importer database integration passed: exact fixture values, repeat import, hidden staging, conflict rollback, and non-staged protection.",
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
