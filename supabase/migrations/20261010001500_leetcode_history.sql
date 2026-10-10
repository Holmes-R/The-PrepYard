begin;
alter table public.leetcode_sync_settings
  add column last_history_at timestamptz,
  add column history_total integer not null default 0 check(history_total between 0 and 20000),
  add column history_matched_count integer not null default 0 check(history_matched_count between 0 and history_total);

create table public.leetcode_history_questions (
  user_id uuid not null references private.students(id) on delete cascade,
  slug text not null check(length(slug)<=200 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  question_id uuid references public.questions(id) on delete restrict,
  imported_at timestamptz not null default now(),
  primary key(user_id,slug)
);
create index leetcode_history_question on public.leetcode_history_questions(question_id) where question_id is not null;
alter table public.leetcode_history_questions enable row level security;
revoke all on public.leetcode_history_questions from public,anon,authenticated;
grant select,insert,update,delete on public.leetcode_history_questions to authenticated;
grant all on public.leetcode_history_questions to service_role;
create policy leetcode_history_read on public.leetcode_history_questions for select to authenticated using(user_id=private.student_id());
create policy leetcode_history_insert on public.leetcode_history_questions for insert to authenticated with check(user_id=private.student_id());
create policy leetcode_history_update on public.leetcode_history_questions for update to authenticated using(user_id=private.student_id()) with check(user_id=private.student_id());
create policy leetcode_history_delete on public.leetcode_history_questions for delete to authenticated using(user_id=private.student_id());
comment on table public.leetcode_history_questions is 'Owner-imported solved slugs from the browser extension. Unmatched slugs are retained. No passwords, cookies, solution code or submission details.';
commit;
