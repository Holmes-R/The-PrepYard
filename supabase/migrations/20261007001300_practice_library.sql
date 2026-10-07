begin;
select pg_advisory_xact_lock(hashtext('prepyard-patterns-v1'));
-- Remove memberships only. Canonical questions and student records survive.
delete from public.pattern_collections where slug in ('striver-sde','striver-a2z','neetcode-150','blind-75','kushal-essential-patterns','prepyard-foundations','prepyard-sequence-strategies','prepyard-structure-traversal','prepyard-search-and-dp');
delete from public.question_patterns where mapping_source in ('prepyard-patterns-v1','prepyard-collections-v1');
alter policy pattern_collections_read on public.pattern_collections using (private.student_id() is not null and slug in ('interview-launchpad','dsa-deep-dive','interview-hotlist'));
create or replace view public.topic_frequency_questions with (security_invoker=true) as
with per_company as (
 select question_id,company_id,max(frequency) frequency
 from public.company_question_observations
 where time_window='all' and frequency_kind='percent' and frequency>0
 group by question_id,company_id
), scored as (
 select question_id,max(frequency) reported_frequency,count(*)::int company_count
 from per_company group by question_id
), ranked as (
 select q.id question_id,qt.topic_id,s.reported_frequency,s.company_count,
 row_number() over(partition by qt.topic_id order by s.reported_frequency desc,s.company_count desc,lower(q.title),q.canonical_url,q.id)::int position
 from scored s join public.questions q on q.id=s.question_id and q.is_listed
 join public.question_dsa_topics qt on qt.question_id=q.id
 where private.student_id() is not null
)
select * from ranked where position<=20;
revoke all on public.topic_frequency_questions from public,anon,authenticated;
grant select on public.topic_frequency_questions to authenticated,service_role;
insert into public.pattern_collections(slug,name) values('interview-hotlist','Interview Hotlist') on conflict(slug) do update set name=excluded.name;
commit;
