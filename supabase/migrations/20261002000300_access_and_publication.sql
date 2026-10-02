begin;
-- Supabase projects may have permissive default grants. Reset privileges on
-- our tables explicitly; do not change privileges on unrelated project tables.
do $$
declare t text;
begin
  foreach t in array array[
    'platforms','companies','sources','company_aliases','questions','patterns',
    'question_patterns','source_snapshots','company_question_observations',
    'import_runs','sheets','sheet_items','user_question_state','notes',
    'practice_events','correction_reports'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to service_role', t);
  end loop;
end $$;
grant usage on schema public to anon, authenticated, service_role;
grant select on public.platforms, public.companies, public.sources,
  public.questions, public.patterns, public.question_patterns,
  public.source_snapshots, public.company_question_observations,
  public.sheets, public.sheet_items to anon, authenticated;
grant insert, update, delete on public.sheets, public.sheet_items to authenticated;
grant select, insert, update, delete on public.user_question_state, public.notes to authenticated;
grant select, insert, delete on public.practice_events to authenticated;
grant select on public.correction_reports to authenticated;
grant insert(reporter_id, question_id, details) on public.correction_reports to authenticated;

create policy platforms_read on public.platforms for select to anon, authenticated using (true);
create policy companies_read on public.companies for select to anon, authenticated using (true);
create policy patterns_read on public.patterns for select to anon, authenticated using (true);
create policy sources_read on public.sources for select to anon, authenticated
  using (is_public and reuse_status = 'approved');
create policy questions_read on public.questions for select to anon, authenticated using (is_listed);
create policy mappings_read on public.question_patterns for select to anon, authenticated
  using (reviewed and exists(select 1 from public.questions q where q.id = question_id));
create policy snapshots_read on public.source_snapshots for select to anon, authenticated
  using (status in ('published','archived') and exists(select 1 from public.sources s where s.id = source_id));
create policy observations_read on public.company_question_observations for select to anon, authenticated
  using (
    exists(select 1 from public.source_snapshots s where s.id = snapshot_id and s.status = 'published')
    and exists(select 1 from public.questions q where q.id = question_id)
  );

create policy sheets_read on public.sheets for select to anon, authenticated
  using (visibility = 'public' or owner_id = (select auth.uid()));
create policy sheets_insert on public.sheets for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy sheets_update on public.sheets for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy sheets_delete on public.sheets for delete to authenticated
  using (owner_id = (select auth.uid()));
create policy items_read on public.sheet_items for select to anon, authenticated
  using (exists(select 1 from public.sheets s where s.id = sheet_id)
    and exists(select 1 from public.questions q where q.id = question_id));
create policy items_insert on public.sheet_items for insert to authenticated
  with check (
    exists(select 1 from public.sheets s where s.id = sheet_id and s.owner_id = (select auth.uid()))
    and exists(select 1 from public.questions q where q.id = question_id));
create policy items_update on public.sheet_items for update to authenticated
  using (exists(select 1 from public.sheets s where s.id = sheet_id and s.owner_id = (select auth.uid())))
  with check (
    exists(select 1 from public.sheets s where s.id = sheet_id and s.owner_id = (select auth.uid()))
    and exists(select 1 from public.questions q where q.id = question_id));
create policy items_delete on public.sheet_items for delete to authenticated
  using (exists(select 1 from public.sheets s where s.id = sheet_id and s.owner_id = (select auth.uid())));

do $$
declare t text;
begin
  foreach t in array array['user_question_state','notes','practice_events'] loop
    execute format('create policy owner_read on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check (user_id = (select auth.uid()) and exists(select 1 from public.questions q where q.id = question_id))', t);
    execute format('create policy owner_delete on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
  foreach t in array array['user_question_state','notes'] loop
    execute format('create policy owner_update on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and exists(select 1 from public.questions q where q.id = question_id))', t);
  end loop;
end $$;
create policy reports_read on public.correction_reports for select to authenticated
  using (reporter_id = (select auth.uid()));
create policy reports_insert on public.correction_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and status = 'open' and resolution is null
    and exists(select 1 from public.questions q where q.id = question_id));

-- SECURITY INVOKER: no privilege escalation. service_role is the only API role
-- with execute permission and is supplied only by trusted server jobs.
create function public.publish_source_snapshot(target_snapshot uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  target_source uuid;
  snapshot_status text;
  source_enabled boolean;
begin
  select source_id into target_source from public.source_snapshots where id = target_snapshot;
  if target_source is null then raise exception 'Unknown snapshot' using errcode = '22023'; end if;
  -- Serialises publication of different snapshots belonging to the same source.
  select enabled and reuse_status = 'approved' and is_public into source_enabled
    from public.sources where id = target_source for update;
  select status into snapshot_status from public.source_snapshots where id = target_snapshot for update;
  if not source_enabled then raise exception 'Source is not approved, enabled and public' using errcode = '22023'; end if;
  if snapshot_status = 'published' then return; end if;
  if snapshot_status not in ('validated','archived') then
    raise exception 'Snapshot must be validated or previously published' using errcode = '22023';
  end if;
  if not exists(select 1 from public.company_question_observations where snapshot_id = target_snapshot) then
    raise exception 'Refusing to publish an empty snapshot' using errcode = '22023';
  end if;
  update public.source_snapshots set status = 'archived'
    where source_id = target_source and status = 'published';
  update public.questions set is_listed = true
    where id in (select question_id from public.company_question_observations where snapshot_id = target_snapshot)
      and not is_listed;
  update public.source_snapshots set status = 'published', published_at = coalesce(published_at, now())
    where id = target_snapshot;
end;
$$;
revoke all on function public.publish_source_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.publish_source_snapshot(uuid) to service_role;
commit;
