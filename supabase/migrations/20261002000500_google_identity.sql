begin;
-- Preserve prior migrations for already-deployed projects. Runtime identity is
-- now owned by this application, not Supabase Auth.
create table private.students (
 id uuid primary key default gen_random_uuid(),
 google_subject text unique check(length(google_subject) between 1 and 255),
 email text check(length(email) between 1 and 320),
 name text not null default '' check(length(name)<=200),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table private.students enable row level security;
revoke all on private.students from public,anon,authenticated;
grant usage on schema private to service_role;
grant select,insert,update,delete on private.students to service_role;
-- Preserve legacy UUIDs and references. Google accounts are never auto-linked
-- by email; migration of existing student accounts needs verified ownership.
insert into private.students(id) select id from auth.users on conflict(id) do nothing;
do $$ declare r record; begin
 for r in select c.conname,c.conrelid::regclass as tab from pg_constraint c where c.contype='f' and c.confrelid='auth.users'::regclass and c.connamespace='public'::regnamespace loop
 execute format('alter table %s drop constraint %I',r.tab,r.conname);
 end loop;
end $$;
alter table public.sheets add constraint sheets_owner_id_fkey foreign key(owner_id) references private.students(id) on delete cascade;
alter table public.user_question_state add constraint user_question_state_user_id_fkey foreign key(user_id) references private.students(id) on delete cascade;
alter table public.notes add constraint notes_user_id_fkey foreign key(user_id) references private.students(id) on delete cascade;
alter table public.practice_events add constraint practice_events_user_id_fkey foreign key(user_id) references private.students(id) on delete cascade;
alter table public.correction_reports add constraint correction_reports_reporter_id_fkey foreign key(reporter_id) references private.students(id) on delete cascade;
create function private.student_id() returns uuid language sql stable set search_path='' as $$
 select nullif(current_setting('prepyard.student_id',true),'')::uuid;
$$;
revoke all on function private.student_id() from public,anon;
grant execute on function private.student_id() to authenticated,service_role;
-- Replace identity lookups without weakening existing ownership/publication rules.
do $$ declare r record; q text; ch text; begin
 for r in select tablename,policyname,qual,with_check from pg_policies where schemaname='public' loop
 q=replace(r.qual,'auth.uid()','private.student_id()');
 ch=replace(r.with_check,'auth.uid()','private.student_id()');
 if q is not null then execute format('alter policy %I on public.%I using (%s)',r.policyname,r.tablename,q); end if;
 if ch is not null then execute format('alter policy %I on public.%I with check (%s)',r.policyname,r.tablename,ch); end if;
 end loop;
end $$;
-- NOLOGIN until a trusted operator provisions a password outside version control.
create role prepyard_web nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
grant authenticated to prepyard_web;
grant usage on schema private to prepyard_web;
create function private.register_google_student(subject text,verified_email text,display_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare student uuid;
begin
 if subject is null or length(subject) not between 1 and 255 or verified_email is null or length(verified_email) not between 1 and 320 or display_name is null or length(display_name)>200 then raise exception 'Invalid verified identity' using errcode='22023'; end if;
 insert into private.students(google_subject,email,name) values(subject,verified_email,display_name)
 on conflict(google_subject) do update set email=excluded.email,name=excluded.name,updated_at=now()
 returning id into student;
 return student;
end $$;
revoke all on function private.register_google_student(text,text,text) from public,anon,authenticated,service_role;
grant execute on function private.register_google_student(text,text,text) to prepyard_web;
comment on function private.register_google_student(text,text,text) is 'Trusted Google callback only. Google subject is the identity; never link by email or accept user-supplied identity.';
commit;
