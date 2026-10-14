begin;
create table public.account_sync_settings (
  user_id uuid not null references private.students(id) on delete cascade,
  provider text not null check (provider in ('gfg')),
  username text not null check (username ~ '^[A-Za-z0-9_-]{1,60}$'),
  enabled boolean not null default true,
  binding_version uuid not null default gen_random_uuid(),
  last_attempt_at timestamptz,
  last_synced_at timestamptz,
  last_error text check (length(last_error) <= 200),
  last_matched_count integer not null default 0 check (last_matched_count >= 0),
  created_at timestamptz not null default now(),
  primary key (user_id,provider)
);
create table public.account_sync_seen (
  user_id uuid not null,
  provider text not null,
  problem_key text not null check (problem_key ~ '^[a-z0-9][a-z0-9-]{0,199}$'),
  observed_at timestamptz not null default now(),
  primary key (user_id,provider,problem_key),
  foreign key (user_id,provider) references public.account_sync_settings(user_id,provider) on delete cascade
);
alter table public.account_sync_settings enable row level security;
alter table public.account_sync_seen enable row level security;
revoke all on public.account_sync_settings,public.account_sync_seen from public,anon,authenticated;
grant select,insert,update,delete on public.account_sync_settings to authenticated;
grant select,insert,delete on public.account_sync_seen to authenticated;
grant all on public.account_sync_settings,public.account_sync_seen to service_role;
create policy account_settings_read on public.account_sync_settings for select to authenticated using(user_id=private.student_id());
create policy account_settings_insert on public.account_sync_settings for insert to authenticated with check(user_id=private.student_id());
create policy account_settings_update on public.account_sync_settings for update to authenticated using(user_id=private.student_id()) with check(user_id=private.student_id());
create policy account_settings_delete on public.account_sync_settings for delete to authenticated using(user_id=private.student_id());
create policy account_seen_read on public.account_sync_seen for select to authenticated using(user_id=private.student_id());
create policy account_seen_insert on public.account_sync_seen for insert to authenticated with check(user_id=private.student_id());
create policy account_seen_delete on public.account_sync_seen for delete to authenticated using(user_id=private.student_id());
comment on table public.account_sync_settings is 'Independent owner-selected public practice accounts; username selection is not proof of ownership. No credentials or solution code.';
comment on table public.account_sync_seen is 'Complete baseline and observed solved problem keys. Old history and repeat polling never undo a later manual uncheck. Unmatched keys are also recorded.';
commit;
