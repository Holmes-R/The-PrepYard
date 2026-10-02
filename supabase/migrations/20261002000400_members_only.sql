begin;
-- Account membership is required for all student data, including shared sheets.
do $$ declare t text; begin
 foreach t in array array['platforms','companies','sources','company_aliases','questions','patterns','question_patterns','source_snapshots','company_question_observations','import_runs','sheets','sheet_items','user_question_state','notes','practice_events','correction_reports'] loop
 execute format('revoke all on public.%I from anon',t);
 end loop;
end $$;
revoke all on public.sources, public.source_snapshots from authenticated;
revoke select on public.company_question_observations from authenticated;
grant select(company_id,question_id,time_window,frequency,frequency_kind,acceptance_percent) on public.company_question_observations to authenticated;
-- Internal lookup permits RLS to check publication without granting metadata access.
create schema if not exists private;
revoke all on schema private from public,anon;
grant usage on schema private to authenticated;
create function private.is_active_snapshot(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.source_snapshots ss join public.sources s on s.id=ss.source_id where ss.id=target and ss.status='published' and s.is_public and s.reuse_status='approved');
$$;
revoke all on function private.is_active_snapshot(uuid) from public,anon;
grant execute on function private.is_active_snapshot(uuid) to authenticated;
drop policy observations_read on public.company_question_observations;
create policy observations_read on public.company_question_observations for select to authenticated
 using (auth.uid() is not null and private.is_active_snapshot(snapshot_id) and exists(select 1 from public.questions q where q.id=question_id));
-- Existing catalogue policies are now restricted to identified students.
do $$ declare r record; begin
 for r in select tablename,policyname,qual from pg_policies where schemaname='public' and cmd='SELECT' and 'anon'=any(roles) loop
 execute format('alter policy %I on public.%I to authenticated using ((auth.uid() is not null) and (%s))',r.policyname,r.tablename,r.qual);
 end loop;
end $$;
commit;
