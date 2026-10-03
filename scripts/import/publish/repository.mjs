export async function publishRepository(client, data) {
  await client.query("begin");
  try {
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended('cs-satyam-all-companies',0))",
    );
    await client.query(
      `create temporary table import_companies on commit drop as select * from jsonb_to_recordset($1::jsonb) as x(slug text,name text)`,
      [JSON.stringify(data.companies)],
    );
    await client.query(
      `create temporary table import_questions on commit drop as select * from jsonb_to_recordset($1::jsonb) as x(external_id text,canonical_url text,title text,difficulty text,original_difficulty text)`,
      [JSON.stringify(data.questions)],
    );
    await client.query(
      `create temporary table import_observations on commit drop as select * from jsonb_to_recordset($1::jsonb) as x(company_slug text,external_id text,time_window text,frequency numeric,frequency_kind text,source_rank integer,acceptance_percent numeric)`,
      [JSON.stringify(data.observations)],
    );
    await client.query(
      "insert into public.platforms(slug,name,base_url) values('leetcode','LeetCode','https://leetcode.com') on conflict(slug) do nothing",
    );
    await client.query(
      "insert into public.companies(slug,name) select slug,name from import_companies on conflict(slug) do nothing",
    );
    await client.query(
      `insert into public.questions(platform_id,external_id,canonical_url,title,difficulty,original_difficulty) select p.id,i.external_id,i.canonical_url,i.title,i.difficulty,i.original_difficulty from import_questions i cross join public.platforms p where p.slug='leetcode' on conflict(platform_id,external_id) do nothing`,
    );
    const mismatch = await client.query(
      `select exists(select 1 from import_questions i join public.questions q on q.external_id=i.external_id join public.platforms p on p.id=q.platform_id where p.slug='leetcode' and (q.canonical_url<>i.canonical_url or q.title<>i.title or q.difficulty is distinct from i.difficulty or q.original_difficulty is distinct from i.original_difficulty)) as bad`,
    );
    if (mismatch.rows[0].bad)
      throw new Error("Existing question metadata conflict");
    await client.query(
      `insert into public.sources(slug,name,url,adapter,attribution) select 'cs-satyam-'||slug,'cs-satyam / '||name,'https://github.com/cs-satyam/leetcode-companywise-questions','cs-satyam-company-csv-v1','cs-satyam/leetcode-companywise-questions; upstream snehasishroy/leetcode-companywise-interview-questions' from import_companies on conflict(slug) do nothing`,
    );
    const identity = await client.query(
      `select exists(select 1 from import_companies i join public.sources s on s.slug='cs-satyam-'||i.slug where s.url<>'https://github.com/cs-satyam/leetcode-companywise-questions' or s.adapter<>'cs-satyam-company-csv-v1') as bad`,
    );
    if (identity.rows[0].bad) throw new Error("Source identity conflict");
    await client.query(
      `insert into public.source_snapshots(source_id,revision) select s.id,$1 from public.sources s join import_companies i on s.slug='cs-satyam-'||i.slug on conflict(source_id,revision) do nothing`,
      [data.revision],
    );
    await client.query(
      `create temporary table import_targets on commit drop as select ss.id,ss.status,i.slug,c.id as company_id from public.source_snapshots ss join public.sources s on s.id=ss.source_id join import_companies i on s.slug='cs-satyam-'||i.slug join public.companies c on c.slug=i.slug where ss.revision=$1`,
      [data.revision],
    );
    if (
      (
        await client.query(
          "select 1 from import_targets where status not in ('staged','validated','published') limit 1",
        )
      ).rowCount
    )
      throw new Error("Snapshot requires review");
    await client.query(
      `insert into public.company_question_observations(snapshot_id,company_id,question_id,time_window,frequency,frequency_kind,source_rank,acceptance_percent) select t.id,t.company_id,q.id,o.time_window,o.frequency,o.frequency_kind,o.source_rank,o.acceptance_percent from import_observations o join import_targets t on t.slug=o.company_slug join public.questions q on q.external_id=o.external_id join public.platforms p on p.id=q.platform_id and p.slug='leetcode' where t.status='staged' on conflict(snapshot_id,company_id,question_id,time_window) do nothing`,
    );
    const actual = await client.query(
      `select c.slug as company_slug,q.external_id,o.time_window,o.frequency::float8 as frequency,o.frequency_kind,o.source_rank,o.acceptance_percent::float8 as acceptance_percent from public.company_question_observations o join import_targets t on t.id=o.snapshot_id join public.companies c on c.id=o.company_id join public.questions q on q.id=o.question_id`,
    );
    const canonical = (rows) =>
      JSON.stringify(
        rows
          .map((r) =>
            JSON.stringify([
              r.company_slug,
              r.external_id,
              r.time_window,
              r.frequency,
              r.frequency_kind,
              r.source_rank,
              r.acceptance_percent,
            ]),
          )
          .sort(),
      );
    if (canonical(actual.rows) !== canonical(data.observations))
      throw new Error(
        "Staged repository observations do not match verified input",
      );
    await client.query(
      `update public.sources s set reuse_status='approved',enabled=true,is_public=true from import_companies i where s.slug='cs-satyam-'||i.slug and (s.reuse_status<>'approved' or not s.enabled or not s.is_public)`,
    );
    await client.query(
      "update public.source_snapshots ss set status='validated' from import_targets t where ss.id=t.id and ss.status='staged'",
    );
    await client.query(
      "select public.publish_source_snapshot(id) from import_targets order by slug",
    );
    await client.query("commit");
    return {
      companies: data.companies.length,
      questions: data.questions.length,
      observations: data.observations.length,
      status: "published",
    };
  } catch (e) {
    await client.query("rollback");
    throw e;
  }
}
