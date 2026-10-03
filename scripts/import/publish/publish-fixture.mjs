import assert from "node:assert/strict";
import { toStagingSql } from "./stage-sql.mjs";
export async function publishFixture(client, snapshot, expected) {
  await client.query("begin");
  try {
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
      snapshot.source.slug,
    ]);
    let state = await client.query(
      "select ss.id,ss.status from public.source_snapshots ss join public.sources s on s.id=ss.source_id where s.slug=$1 and ss.revision=$2",
      [snapshot.source.slug, snapshot.source.revision],
    );
    if (!state.rows.length || state.rows[0].status === "staged") {
      const staging = toStagingSql(snapshot)
        .replace("begin;", "")
        .replace(/commit;\s*$/, "");
      await client.query(staging);
      state = await client.query(
        "select ss.id,ss.status from public.source_snapshots ss join public.sources s on s.id=ss.source_id where s.slug=$1 and ss.revision=$2",
        [snapshot.source.slug, snapshot.source.revision],
      );
    }
    const target = state.rows[0];
    if (!["staged", "validated", "published"].includes(target.status))
      throw new Error("Snapshot needs manual review");
    const scope = await client.query(
      `select exists(select 1 from public.sources s join public.source_snapshots ss on ss.source_id=s.id where ss.id=$1 and s.url=$2 and s.adapter='cs-satyam-company-csv-v1' and s.attribution=$3) and not exists(select 1 from public.company_question_observations o join public.companies c on c.id=o.company_id join public.questions q on q.id=o.question_id join public.platforms p on p.id=q.platform_id where o.snapshot_id=$1 and (c.slug<>$4 or c.name<>$5 or p.slug<>'leetcode')) as ok`,
      [
        target.id,
        snapshot.source.repository,
        snapshot.source.attribution,
        snapshot.source.company.slug,
        snapshot.source.company.name,
      ],
    );
    if (!scope.rows[0].ok)
      throw new Error(
        "Publication scope does not match reviewed company/platform/source",
      );
    const actual = await client.query(
      `select jsonb_build_object(
   'questions',(select jsonb_agg(x order by x->>'external_id') from (select distinct jsonb_build_object('external_id',q.external_id,'canonical_url',q.canonical_url,'title',q.title,'difficulty',q.difficulty,'original_difficulty',q.original_difficulty) x from public.questions q join public.company_question_observations o on o.question_id=q.id where o.snapshot_id=$1) t),
   'observations',(select jsonb_agg(jsonb_build_object('external_id',q.external_id,'time_window',o.time_window,'frequency',o.frequency,'frequency_kind',o.frequency_kind,'source_rank',o.source_rank,'acceptance_percent',o.acceptance_percent) order by o.time_window,q.external_id) from public.company_question_observations o join public.questions q on q.id=o.question_id where o.snapshot_id=$1)) as fixture`,
      [target.id],
    );
    assert.deepEqual(
      actual.rows[0].fixture,
      { questions: expected.questions, observations: expected.observations },
      "Staged data must match the independent expected fixture",
    );
    await client.query(
      "update public.sources set reuse_status='approved',enabled=true,is_public=true where slug=$1 and (reuse_status<>'approved' or not enabled or not is_public)",
      [snapshot.source.slug],
    );
    await client.query(
      "update public.source_snapshots set status='validated' where id=$1 and status='staged'",
      [target.id],
    );
    await client.query("select public.publish_source_snapshot($1)", [
      target.id,
    ]);
    await client.query("commit");
    return {
      company: snapshot.source.company.name,
      questions: expected.questions.length,
      observations: expected.observations.length,
      status: "published",
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}
