begin;
create function pg_temp.denied(statement text) returns void language plpgsql as $$
begin begin execute statement; exception when insufficient_privilege then return; end; raise exception 'Unexpected access: %',statement; end $$;
-- Publish the pinned importer fixture for the final access contract.
set local role service_role;
update public.sources set reuse_status='approved',enabled=true,is_public=true;
select public.publish_source_snapshot(id) from public.source_snapshots;
reset role;
set local role anon;
do $$ declare t text; begin foreach t in array array['platforms','companies','sources','questions','patterns','question_patterns','source_snapshots','company_question_observations','sheets','sheet_items','notes','user_question_state','practice_events','correction_reports','import_runs','company_aliases'] loop perform pg_temp.denied(format('select * from public.%I',t)); end loop; end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select pg_temp.denied('select * from public.sources');
select pg_temp.denied('select * from public.source_snapshots');
select pg_temp.denied('select snapshot_id from public.company_question_observations');
select pg_temp.denied('select source_rank from public.company_question_observations');
select pg_temp.denied('select * from public.import_runs');
select company_id,question_id,time_window,frequency,frequency_kind,acceptance_percent from public.company_question_observations;
select * from public.questions;
do $$ begin
 if (select count(company_id) from public.company_question_observations) <> 2 then raise exception 'Published observations unavailable'; end if;
 if (select count(*) from public.questions) <> 1 then raise exception 'Published question unavailable'; end if;
end $$;
select set_config('request.jwt.claim.sub','',true);
do $$ begin if exists(select 1 from public.questions) then raise exception 'Missing identity can read catalogue'; end if; end $$;
reset role;
rollback;
select 'Membership and private metadata access checks passed' as result;
