// Generates one transaction. Applying it requires a trusted database connection.
// It NEVER approves a source, validates/publishes a snapshot, or edits user data.
export function toStagingSql(snapshot) {
  const json = JSON.stringify(snapshot).replaceAll("'", "''");
  let delimiter = "$prepyard$";
  while (json.includes(delimiter)) delimiter = delimiter.slice(0, -1) + "_$";
  return `-- Generated from a checksum-verified company fixture. Review before applying.
begin;
set local standard_conforming_strings = on;
do ${delimiter}
declare
  data jsonb := '${json}'::jsonb;
  src uuid; plat uuid; company uuid; snap uuid;
  question jsonb; observation jsonb; current_question public.questions%rowtype;
  snapshot_state text;
begin
  perform pg_advisory_xact_lock(hashtextextended(data#>>'{source,slug}', 0));
  insert into public.platforms(slug,name,base_url)
    values (data#>>'{platform,slug}',data#>>'{platform,name}',data#>>'{platform,base_url}')
    on conflict(slug) do nothing;
  select id into plat from public.platforms where slug=data#>>'{platform,slug}';
  if not exists(select 1 from public.platforms where id=plat and name=data#>>'{platform,name}' and base_url=data#>>'{platform,base_url}') then raise exception 'Conflicting platform metadata'; end if;
  insert into public.companies(slug,name)
    values (data#>>'{source,company,slug}',data#>>'{source,company,name}') on conflict(slug) do nothing;
  select id into company from public.companies where slug=data#>>'{source,company,slug}';
  if not exists(select 1 from public.companies where id=company and name=data#>>'{source,company,name}') then raise exception 'Conflicting company metadata'; end if;
  insert into public.sources(slug,name,url,adapter,attribution)
    values(data#>>'{source,slug}', 'cs-satyam / 1Kosmos',data#>>'{source,repository}',
      'cs-satyam-company-csv-v1',data#>>'{source,attribution}') on conflict(slug) do nothing;
  select id into src from public.sources where slug=data#>>'{source,slug}' for update;
  if not exists(select 1 from public.sources where id=src and url=data#>>'{source,repository}'
      and adapter='cs-satyam-company-csv-v1' and attribution=data#>>'{source,attribution}') then raise exception 'Conflicting source identity'; end if;
  insert into public.source_snapshots(source_id,revision,dataset_date)
    values(src,data#>>'{source,revision}',(data#>>'{source,dataset_date}')::date)
    on conflict(source_id,revision) do nothing;
  select id,status into snap,snapshot_state from public.source_snapshots
    where source_id=src and revision=data#>>'{source,revision}' for update;
  if snapshot_state <> 'staged' then raise exception 'Refusing to modify a non-staged snapshot'; end if;
  if not exists(select 1 from public.source_snapshots where id=snap
    and dataset_date is not distinct from (data#>>'{source,dataset_date}')::date) then
    raise exception 'Conflicting snapshot date';
  end if;
  for question in select value from jsonb_array_elements(data->'questions') loop
    insert into public.questions(platform_id,external_id,canonical_url,title,difficulty,original_difficulty)
      values(plat,question->>'external_id',question->>'canonical_url',question->>'title',
        question->>'difficulty',question->>'original_difficulty')
      on conflict(platform_id,external_id) do nothing;
    select * into current_question from public.questions
      where platform_id=plat and external_id=question->>'external_id';
    if current_question.canonical_url is distinct from question->>'canonical_url'
      or current_question.title is distinct from question->>'title'
      or current_question.difficulty is distinct from question->>'difficulty'
      or current_question.original_difficulty is distinct from question->>'original_difficulty' then
      raise exception 'Question metadata conflict; reconcile explicitly';
    end if;
  end loop;
  for observation in select value from jsonb_array_elements(data->'observations') loop
    select * into current_question from public.questions
      where platform_id=plat and external_id=observation->>'external_id';
    insert into public.company_question_observations(snapshot_id,company_id,question_id,time_window,frequency,frequency_kind,source_rank,acceptance_percent)
      values(snap,company,current_question.id,observation->>'time_window',
        (observation->>'frequency')::numeric,observation->>'frequency_kind',
        (observation->>'source_rank')::integer,(observation->>'acceptance_percent')::numeric)
      on conflict(snapshot_id,company_id,question_id,time_window) do nothing;
    if not exists(select 1 from public.company_question_observations o where
      o.snapshot_id=snap and o.company_id=company and o.question_id=current_question.id
      and o.time_window=observation->>'time_window'
      and o.frequency is not distinct from (observation->>'frequency')::numeric
      and o.frequency_kind=observation->>'frequency_kind'
      and o.source_rank is not distinct from (observation->>'source_rank')::integer
      and o.acceptance_percent is not distinct from (observation->>'acceptance_percent')::numeric) then
      raise exception 'Observation conflict in pinned snapshot';
    end if;
  end loop;
  if (select count(*) from public.company_question_observations where snapshot_id=snap)
      <> jsonb_array_length(data->'observations') then raise exception 'Snapshot contains unexpected observations'; end if;
end;
${delimiter};
commit;
`;
}
