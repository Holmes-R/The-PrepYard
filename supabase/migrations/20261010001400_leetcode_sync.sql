begin;

create table public.leetcode_sync_settings (
  user_id uuid primary key references private.students(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_-]{1,40}$'),
  enabled boolean not null default true,
  binding_version uuid not null default gen_random_uuid(),
  last_attempt_at timestamptz,
  last_synced_at timestamptz,
  last_error text check (length(last_error) <= 200),
  last_matched_count integer not null default 0 check (last_matched_count >= 0),
  created_at timestamptz not null default now()
);

create table public.leetcode_sync_receipts (
  user_id uuid not null references private.students(id) on delete cascade,
  submission_id text not null check (submission_id ~ '^[0-9]{1,30}$'),
  question_id uuid not null references public.questions(id) on delete restrict,
  submitted_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, submission_id)
);
create index leetcode_receipts_question on public.leetcode_sync_receipts(question_id);

alter table public.leetcode_sync_settings enable row level security;
alter table public.leetcode_sync_receipts enable row level security;
revoke all on public.leetcode_sync_settings, public.leetcode_sync_receipts from public, anon, authenticated;
grant select, insert, update, delete on public.leetcode_sync_settings to authenticated;
grant select, insert, delete on public.leetcode_sync_receipts to authenticated;
grant all on public.leetcode_sync_settings, public.leetcode_sync_receipts to service_role;

create policy leetcode_settings_read on public.leetcode_sync_settings for select to authenticated using (user_id = private.student_id());
create policy leetcode_settings_insert on public.leetcode_sync_settings for insert to authenticated with check (user_id = private.student_id());
create policy leetcode_settings_update on public.leetcode_sync_settings for update to authenticated using (user_id = private.student_id()) with check (user_id = private.student_id());
create policy leetcode_settings_delete on public.leetcode_sync_settings for delete to authenticated using (user_id = private.student_id());
create policy leetcode_receipts_read on public.leetcode_sync_receipts for select to authenticated using (user_id = private.student_id());
create policy leetcode_receipts_insert on public.leetcode_sync_receipts for insert to authenticated with check (user_id = private.student_id());
create policy leetcode_receipts_delete on public.leetcode_sync_receipts for delete to authenticated using (user_id = private.student_id());

comment on table public.leetcode_sync_settings is 'Owner-selected public LeetCode profile. A username is not proof of account ownership. Never stores LeetCode passwords, sessions, cookies, or code.';
comment on table public.leetcode_sync_receipts is 'Idempotency ledger for matched public Accepted submissions. A repeat sync must not undo a later manual uncheck.';

commit;
