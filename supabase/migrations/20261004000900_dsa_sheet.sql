begin;
create table public.dsa_topics (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 name text not null check(length(btrim(name)) between 1 and 100),
 position integer not null check(position >= 0)
);
-- Exactly one teaching topic per question keeps sheet totals unambiguous.
create table public.question_dsa_topics (
 question_id uuid primary key references public.questions(id) on delete cascade,
 topic_id uuid not null references public.dsa_topics(id) on delete restrict
);
create index question_dsa_topics_topic on public.question_dsa_topics(topic_id,question_id);
create table public.pattern_collections (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 name text not null check(length(btrim(name)) between 1 and 200)
);
create table public.pattern_collection_questions (
 collection_id uuid not null references public.pattern_collections(id) on delete cascade,
 question_id uuid not null references public.questions(id) on delete cascade,
 position integer not null check(position >= 0),
 primary key(collection_id,question_id)
);
create index pattern_collection_questions_question on public.pattern_collection_questions(question_id,collection_id);
do $$ declare t text; begin
 foreach t in array array['dsa_topics','question_dsa_topics','pattern_collections','pattern_collection_questions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public, anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to service_role',t);
 end loop;
end $$;
create policy dsa_topics_read on public.dsa_topics for select to authenticated using(private.student_id() is not null);
create policy dsa_membership_read on public.question_dsa_topics for select to authenticated using(private.student_id() is not null and exists(select 1 from public.questions q where q.id=question_id));
create policy pattern_collections_read on public.pattern_collections for select to authenticated using(private.student_id() is not null);
create policy collection_questions_read on public.pattern_collection_questions for select to authenticated using(private.student_id() is not null and exists(select 1 from public.questions q where q.id=question_id));
commit;
